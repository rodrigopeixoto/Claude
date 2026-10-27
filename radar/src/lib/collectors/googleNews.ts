import { cfg, fetchText, keywordQuery, type Collector } from "./types";
import { parseFeed } from "./rssParse";

type Config = { query: string; hl: string; gl: string; ceid: string };

/** Google News search RSS. Free, no key; returns up to ~100 recent articles. */
export const googleNews: Collector = async ({ source, client }) => {
  const c = cfg<Config>(source);
  const query = `${c.query || keywordQuery(client)} when:7d`;
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
