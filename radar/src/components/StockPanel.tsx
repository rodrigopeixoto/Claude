import { PERIODS, type StockReturns } from "@/lib/stocks";
import { Sparkline } from "./Sparkline";

export function StockPanel({ stock }: { stock: (StockReturns & { history: { date: Date; close: number }[] }) | null }) {
  if (!stock) return null;
  const year = stock.history.filter((q) => q.date.getTime() >= stock.asOf.getTime() - 365 * 86_400_000);
  return (
    <section className="card p-5" id="bolsa">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink-2">Ações na bolsa · {stock.ticker}</h2>
          <p className="text-xs text-ink-3">
            Último fechamento {stock.last.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {stock.currency} em {stock.asOf.toLocaleDateString("pt-BR", { timeZone: "UTC" })}. Fonte: Yahoo Finance.
          </p>
        </div>
        <Sparkline points={year.map((q) => q.close)} width={220} height={44} min={Math.min(...year.map((q) => q.close))} max={Math.max(...year.map((q) => q.close))} label="Cotação em 12 meses" />
      </div>
      <dl className="mt-3 grid grid-cols-5 gap-2 text-center">
        {PERIODS.map((p) => {
          const v = stock.returns[p];
          return (
            <div key={p} className="rounded-lg bg-surface-2 py-2">
              <dt className="text-xs text-ink-3">{p === 365 ? "12 meses" : `${p} dias`}</dt>
              <dd className="font-semibold">
                {v == null ? "—" : `${v > 0 ? "▲ +" : v < 0 ? "▼ " : ""}${(v * 100).toFixed(1)}%`}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
