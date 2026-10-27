import { CollectorConfigError, cfg, fetchJson, type Collector, type RawItem } from "./types";

type Config = { appId: string; country: string; pages: number };

interface Label { label: string }
interface Entry {
  id: Label;
  author?: { name: Label; uri?: Label };
  "im:rating"?: Label;
  "im:version"?: Label;
  "im:voteSum"?: Label;
  title?: Label;
  content?: Label;
  updated?: Label;
}

/** Apple public customer-reviews RSS (JSON). Up to 10 pages × 50 reviews per country. */
export const appStore: Collector = async ({ source, since }) => {
  const c = cfg<Config>(source);
  if (!c.appId) throw new CollectorConfigError("config.appId obrigatório (ID numérico da App Store)");
  const country = c.country ?? "br";
  const items: RawItem[] = [];
  for (let page = 1; page <= (c.pages ?? 2); page++) {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${c.appId}/sortby=mostrecent/json`;
    const data = await fetchJson<{ feed?: { entry?: Entry | Entry[] } }>(url);
    const raw = data.feed?.entry;
    const entries = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    const reviews = entries.filter((e) => e["im:rating"]);
    for (const e of reviews) {
      items.push({
        channel: "APP_STORE",
        externalId: e.id.label,
        url: `https://apps.apple.com/${country}/app/id${c.appId}?see-all=reviews`,
        title: e.title?.label,
        content: [e.title?.label, e.content?.label].filter(Boolean).join(". "),
        author: e.author?.name.label,
        publishedAt: new Date(e.updated?.label ?? Date.now()),
        rating: Number(e["im:rating"]!.label),
        engagement: e["im:voteSum"] ? Number(e["im:voteSum"].label) : undefined,
        raw: { version: e["im:version"]?.label },
      });
    }
    const oldest = reviews.at(-1);
    if (reviews.length === 0 || (oldest && new Date(oldest.updated?.label ?? 0) < since)) break;
  }
  return items;
};
