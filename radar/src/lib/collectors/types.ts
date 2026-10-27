import type { Channel, Client, Source } from "@prisma/client";

export interface RawItem {
  channel: Channel;
  externalId: string;
  url?: string;
  title?: string;
  content: string;
  author?: string;
  publishedAt: Date;
  rating?: number;
  engagement?: number;
  raw?: unknown;
}

export interface CollectContext {
  source: Source;
  client: Client;
  /** Only items newer than this are wanted (best effort; dedupe handles the rest). */
  since: Date;
}

export type Collector = (ctx: CollectContext) => Promise<RawItem[]>;

export class CollectorConfigError extends Error {}

export function cfg<T extends Record<string, unknown>>(source: Source): Partial<T> {
  const value = source.config;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<T>) : {};
}

/** Default search expression from the client's keywords: "a" OR "b". */
export function keywordQuery(client: Client): string {
  if (client.keywords.length === 0) throw new CollectorConfigError("Cliente sem palavras-chave");
  return client.keywords.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" OR ");
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "user-agent": "Mozilla/5.0 (compatible; RadarBot/0.1)", ...init?.headers },
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
  return res.text();
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return JSON.parse(await fetchText(url, init)) as T;
}
