import type { Channel } from "@prisma/client";
import { stripHtml } from "../text";
import { CollectorConfigError, cfg, type Collector, type RawItem } from "./types";

/**
 * Generic Apify actor runner, used for sources without a usable official API
 * (Reclame Aqui, LinkedIn, Instagram, Facebook). Any actor from the Apify Store works:
 * set config.actorId and config.input. "{{keywords}}" / "{{keywordsList}}" / "{{since}}"
 * inside input strings are replaced at run time. Output fields are mapped heuristically,
 * or explicitly through config.fieldMap.
 */
type FieldKey = "id" | "url" | "title" | "content" | "author" | "date" | "rating" | "likes" | "comments" | "shares";
type Config = {
  actorId: string;
  input: Record<string, unknown>;
  fieldMap: Partial<Record<FieldKey, string>>;
  maxItems: number;
};

const CANDIDATES: Record<FieldKey, string[]> = {
  id: ["id", "postId", "urn", "shortCode", "complaintId", "reviewId", "url", "postUrl"],
  url: ["url", "postUrl", "link", "permalink", "complaintUrl", "inputUrl"],
  title: ["title", "headline", "complaintTitle"],
  content: ["text", "content", "description", "caption", "postText", "body", "message", "complaint", "commentary"],
  author: ["author.name", "authorName", "author.fullName", "ownerUsername", "ownerFullName", "user.name", "userName", "pageName", "author"],
  date: ["date", "postedAt", "postedAtISO", "createdAt", "created", "timestamp", "publishedAt", "time", "postedDate"],
  rating: ["rating", "score", "stars", "evaluation.score"],
  likes: ["likesCount", "likes", "numLikes", "reactionsCount", "totalReactionCount", "stats.likes"],
  comments: ["commentsCount", "comments", "numComments", "stats.comments"],
  shares: ["sharesCount", "shares", "numShares", "reposts", "stats.shares"],
};

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

function pick(item: unknown, key: FieldKey, fieldMap: Config["fieldMap"]): unknown {
  const paths = fieldMap?.[key] ? [fieldMap[key]!] : CANDIDATES[key];
  for (const p of paths) {
    const v = getPath(item, p);
    if (v != null && v !== "" && typeof v !== "object") return v;
  }
  return undefined;
}

function toDate(v: unknown): Date | undefined {
  if (v == null) return undefined;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  if (Array.isArray(v)) return v.length;
  return undefined;
}

function fillTemplate(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const whole = /^\{\{(\w+)\}\}$/.exec(value);
    if (whole && whole[1] in vars) return vars[whole[1]];
    return value.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  }
  if (Array.isArray(value)) return value.map((v) => fillTemplate(v, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillTemplate(v, vars)]));
  }
  return value;
}

export function mapApifyItem(item: unknown, channel: Channel, fieldMap: Config["fieldMap"] = {}): RawItem | null {
  const content = pick(item, "content", fieldMap);
  const title = pick(item, "title", fieldMap);
  const text = stripHtml(String(content ?? title ?? ""));
  if (!text) return null;
  const url = pick(item, "url", fieldMap);
  const id = pick(item, "id", fieldMap) ?? url ?? text.slice(0, 200);
  const engagementParts = (["likes", "comments", "shares"] as const).map((k) => toNumber(pick(item, k, fieldMap)));
  const engagement = engagementParts.some((n) => n != null) ? engagementParts.reduce<number>((a, n) => a + (n ?? 0), 0) : undefined;
  const rating = toNumber(pick(item, "rating", fieldMap));
  return {
    channel,
    externalId: String(id),
    url: url ? String(url) : undefined,
    title: title ? stripHtml(String(title)) : undefined,
    content: title && content ? `${stripHtml(String(title))}. ${text}` : text,
    author: pick(item, "author", fieldMap) as string | undefined,
    publishedAt: toDate(pick(item, "date", fieldMap)) ?? new Date(),
    rating: rating != null && rating >= 0 && rating <= 10 ? Math.round(rating) : undefined,
    engagement,
    raw: item,
  };
}

export function apifyCollector(channel: Channel): Collector {
  return async ({ source, client, since }) => {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new CollectorConfigError("APIFY_TOKEN não configurado");
    const c = cfg<Config>(source);
    if (!c.actorId) throw new CollectorConfigError("config.actorId obrigatório (ex.: autor~nome-do-actor)");
    const input = fillTemplate(c.input ?? {}, {
      keywords: client.keywords.join(" OR "),
      keywordsList: client.keywords,
      firstKeyword: client.keywords[0] ?? client.name,
      since: since.toISOString(),
      sinceDate: since.toISOString().slice(0, 10),
    });
    const actor = c.actorId.replace("/", "~");
    const params = new URLSearchParams({ timeout: "240", format: "json", clean: "true", limit: String(c.maxItems ?? 100) });
    const res = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?${params}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) throw new Error(`Apify HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const items = (await res.json()) as unknown[];
    return items.map((i) => mapApifyItem(i, channel, c.fieldMap)).filter((i): i is RawItem => i !== null);
  };
}
