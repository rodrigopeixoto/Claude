import { prisma } from "./db";

const DAY = 24 * 3600_000;
export const PERIODS = [7, 30, 60, 90, 365] as const;

interface Quote {
  date: Date;
  close: number;
}

export interface StockReturns {
  ticker: string;
  currency: string;
  last: number;
  asOf: Date;
  /** Fractional change over each period (0.05 = +5%); null when history is too short. */
  returns: Record<(typeof PERIODS)[number], number | null>;
}

/** Return over `days`, from the last close on or before (lastDate - days) to the last close. */
export function computeReturns(quotes: Quote[]): StockReturns["returns"] | null {
  const sorted = [...quotes].sort((a, b) => a.date.getTime() - b.date.getTime());
  const last = sorted.at(-1);
  if (!last) return null;
  const out = {} as StockReturns["returns"];
  for (const days of PERIODS) {
    const target = last.date.getTime() - days * DAY;
    let base: Quote | undefined;
    for (const q of sorted) {
      if (q.date.getTime() <= target) base = q;
      else break;
    }
    out[days] = base && base.close > 0 ? last.close / base.close - 1 : null;
  }
  return out;
}

interface YahooChart {
  chart: {
    result: { meta: { currency: string }; timestamp?: number[]; indicators: { quote: { close: (number | null)[] }[] } }[] | null;
    error: { description?: string } | null;
  };
}

/** Daily closes for the last ~13 months from Yahoo Finance's public chart endpoint. */
export async function fetchYahoo(ticker: string): Promise<{ currency: string; quotes: Quote[] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=13mo&interval=1d`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} para ${ticker}`);
  const data = (await res.json()) as YahooChart;
  const r = data.chart.result?.[0];
  if (!r || !r.timestamp) throw new Error(`Yahoo: ${data.chart.error?.description ?? "sem dados"} (${ticker})`);
  const closes = r.indicators.quote[0]?.close ?? [];
  const quotes: Quote[] = [];
  r.timestamp.forEach((t, i) => {
    const c = closes[i];
    if (c != null) quotes.push({ date: new Date(Math.floor((t * 1000) / DAY) * DAY), close: c });
  });
  return { currency: r.meta.currency, quotes };
}

export async function refreshTicker(ticker: string) {
  const { currency, quotes } = await fetchYahoo(ticker);
  await prisma.stockQuote.createMany({
    data: quotes.map((q) => ({ ticker, date: q.date, close: q.close, currency })),
    skipDuplicates: true,
  });
  // The latest bar can be intraday; keep it current.
  const last = quotes.at(-1);
  if (last) {
    await prisma.stockQuote.update({ where: { ticker_date: { ticker, date: last.date } }, data: { close: last.close } });
  }
  return quotes.length;
}

export async function refreshAllTickers(log = console.log) {
  const tickers = await prisma.client.findMany({ where: { ticker: { not: null } }, select: { ticker: true }, distinct: ["ticker"] });
  for (const { ticker } of tickers) {
    try {
      const n = await refreshTicker(ticker!);
      log(`[bolsa] ${ticker}: ${n} cotações`);
    } catch (err) {
      log(`[bolsa] ${ticker}: ERRO ${err instanceof Error ? err.message : err}`);
    }
  }
}

export async function getStock(ticker: string): Promise<(StockReturns & { history: Quote[] }) | null> {
  const rows = await prisma.stockQuote.findMany({
    where: { ticker, date: { gte: new Date(Date.now() - 400 * DAY) } },
    orderBy: { date: "asc" },
  });
  const returns = computeReturns(rows);
  const last = rows.at(-1);
  if (!returns || !last) return null;
  return {
    ticker,
    currency: last.currency,
    last: last.close,
    asOf: last.date,
    returns,
    history: rows.map((r) => ({ date: r.date, close: r.close })),
  };
}
