import { cfg, keywordQuery, type Collector } from "./types";

type Config = { query: string; sourcelang: string; timespan: string; maxrecords: number };

interface GdeltResponse {
  articles?: { url: string; title: string; seendate: string; domain: string; language: string }[];
}

export function parseSeenDate(s: string): Date {
  // 20261027T143000Z
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : new Date();
}

// GDELT allows ~1 request per 5 s per IP; serialise calls within this process.
const MIN_GAP_MS = 6000;
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

/** GDELT DOC 2.0 API — global news index, free, no key. */
export const gdelt: Collector = async ({ source, client }) => {
  const c = cfg<Config>(source);
  const base = c.query || keywordQuery(client);
  const query = `${base.includes(" OR ") ? `(${base})` : base}${c.sourcelang === "any" ? "" : ` sourcelang:${c.sourcelang ?? "por"}`}`;
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    sort: "datedesc",
    maxrecords: String(c.maxrecords ?? 75),
    timespan: c.timespan ?? "3d",
  });
  await throttle();
  const text = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
    signal: AbortSignal.timeout(30_000),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} em GDELT`);
    return r.text();
  });
  // GDELT answers plain-text errors (e.g. query too short) with HTTP 200.
  if (!text.trimStart().startsWith("{")) throw new Error(`GDELT: ${text.slice(0, 200)}`);
  const data = JSON.parse(text) as GdeltResponse;
  return (data.articles ?? []).map((a) => ({
    channel: "NEWS" as const,
    externalId: a.url,
    url: a.url,
    title: a.title,
    content: a.title,
    author: a.domain,
    publishedAt: parseSeenDate(a.seendate),
  }));
};
