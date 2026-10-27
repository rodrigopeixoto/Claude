import { cfg, fetchText, keywordQuery, type Collector } from "./types";
import { parseFeed } from "./rssParse";

type Config = { query: string; hl: string; gl: string; ceid: string };

/** Google News search RSS. Free, no key; up to ~100 articles per call. */
export const googleNews: Collector = async ({ source, client, since }) => {
  const c = cfg<Config>(source);
  // Google News caps a search at ~100 items, so the window follows what is still missing.
  const days = Math.min(365, Math.max(1, Math.ceil((Date.now() - since.getTime()) / 86_400_000)));
  const query = `${c.query || keywordQuery(client)} when:${days}d`;
  const params = new URLSearchParams({
    q: query,
    hl: c.hl ?? "pt-BR",
    gl: c.gl ?? "BR",
    ceid: c.ceid ?? "BR:pt-419",
  });
  const xml = await fetchText(`https://news.google.com/rss/search?${params}`);
  return parseFeed(xml).map((e) => ({
    channel: "NEWS" as const,
    externalId: e.id,
    url: e.link,
    title: e.title,
    content: e.description && e.description !== e.title ? `${e.title}. ${e.description}` : e.title,
    author: e.sourceName,
    publishedAt: e.publishedAt,
  }));
};
