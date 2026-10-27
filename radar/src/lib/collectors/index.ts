import type { SourceType } from "@prisma/client";
import { apifyCollector } from "./apify";
import { appStore } from "./appStore";
import { gdelt } from "./gdelt";
import { googleNews } from "./googleNews";
import { playStore } from "./playStore";
import { rss } from "./rss";
import type { Collector } from "./types";
import { youtube } from "./youtube";

export const collectors: Record<SourceType, Collector> = {
  GOOGLE_NEWS: googleNews,
  GDELT: gdelt,
  RSS: rss,
  APP_STORE: appStore,
  PLAY_STORE: playStore,
  YOUTUBE: youtube,
  RECLAME_AQUI: apifyCollector("RECLAME_AQUI"),
  LINKEDIN: apifyCollector("LINKEDIN"),
  INSTAGRAM: apifyCollector("INSTAGRAM"),
  FACEBOOK: apifyCollector("FACEBOOK"),
};
