import gplay from "google-play-scraper";
import { CollectorConfigError, cfg, type Collector } from "./types";

type Config = { appId: string; lang: string; country: string; num: number };

// gplay.sort.NEWEST; the package typings declare `sort` as the enum type instead of its object.
const SORT_NEWEST = 2;

/** Google Play reviews via google-play-scraper (public web endpoint, no key). */
export const playStore: Collector = async ({ source }) => {
  const c = cfg<Config>(source);
  if (!c.appId) throw new CollectorConfigError("config.appId obrigatório (ex.: com.nu.production)");
  const result = await gplay.reviews({
    appId: c.appId,
    lang: c.lang ?? "pt",
    country: c.country ?? "br",
    sort: SORT_NEWEST,
    num: c.num ?? 150,
  });
  return result.data.map((r) => ({
    channel: "PLAY_STORE" as const,
    externalId: r.id,
    url: r.url,
    title: r.title ?? undefined,
    content: r.text ?? "",
    author: r.userName,
    publishedAt: new Date(r.date),
    rating: r.score,
    engagement: r.thumbsUp,
    raw: { version: r.version, replied: Boolean(r.replyText) },
  }));
};
