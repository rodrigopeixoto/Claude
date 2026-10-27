import { containsAny } from "../text";
import { CollectorConfigError, cfg, fetchText, type Collector } from "./types";
import { parseFeed } from "./rssParse";

type Config = { url: string; matchAll: boolean };

/** Any RSS/Atom feed (portal, blog, press room). Keeps only items citing the client unless matchAll. */
export const rss: Collector = async ({ source, client }) => {
  const c = cfg<Config>(source);
  if (!c.url) throw new CollectorConfigError("config.url obrigatório");
  const entries = parseFeed(await fetchText(c.url));
  return entries
    .filter((e) => c.matchAll || containsAny(`${e.title} ${e.description}`, client.keywords))
    .map((e) => ({
      channel: "NEWS" as const,
      externalId: e.id,
      url: e.link,
      title: e.title,
      content: e.description ? `${e.title}. ${e.description}` : e.title,
      author: e.sourceName ?? new URL(c.url!).host,
      publishedAt: e.publishedAt,
    }));
};
