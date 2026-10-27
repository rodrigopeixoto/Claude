import { Prisma, type Client, type Source } from "@prisma/client";
import { collectors } from "../collectors";
import type { RawItem } from "../collectors/types";
import { prisma } from "../db";
import { containsAny, normalize, sha256, stripPublisherSuffix, truncate } from "../text";

const DEFAULT_LOOKBACK_DAYS = 7;

export function mentionHash(item: RawItem): string {
  // News gets syndicated under many URLs; dedupe on the headline instead.
  if (item.channel === "NEWS" && item.title) return sha256(`NEWS:${normalize(stripPublisherSuffix(item.title))}`);
  return sha256(`${item.channel}:${item.externalId}`);
}

export function filterItems(items: RawItem[], client: Pick<Client, "excludeTerms">, since: Date): RawItem[] {
  return items.filter(
    (i) =>
      i.content.trim().length > 0 &&
      i.publishedAt >= since &&
      !(client.excludeTerms.length > 0 && containsAny(`${i.title ?? ""} ${i.content}`, client.excludeTerms)),
  );
}

export interface RunResult {
  sourceId: string;
  label: string;
  ok: boolean;
  found: number;
  inserted: number;
  error?: string;
}

export async function runSource(sourceId: string): Promise<RunResult> {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId }, include: { client: true } });
  return runLoadedSource(source);
}

async function runLoadedSource(source: Source & { client: Client }): Promise<RunResult> {
  const run = await prisma.collectorRun.create({ data: { sourceId: source.id } });
  // First run looks back a week; later runs overlap the previous one by a day so late items aren't lost.
  const since = source.lastRunAt
    ? new Date(source.lastRunAt.getTime() - 24 * 3600_000)
    : new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 3600_000);

  try {
    const raw = await collectors[source.type]({ source, client: source.client, since });
    const items = filterItems(raw, source.client, since);
    const rows: Prisma.MentionCreateManyInput[] = items.map((i) => ({
      clientId: source.clientId,
      sourceId: source.id,
      channel: i.channel,
      hash: mentionHash(i),
      externalId: truncate(i.externalId, 500),
      url: i.url,
      title: i.title ? truncate(i.title, 500) : null,
      content: truncate(i.content, 8000),
      author: i.author ? truncate(String(i.author), 200) : null,
      publishedAt: i.publishedAt,
      rating: i.rating ?? null,
      engagement: i.engagement ?? null,
      raw: i.raw === undefined ? Prisma.JsonNull : (i.raw as Prisma.InputJsonValue),
    }));
    const { count } = await prisma.mention.createMany({ data: rows, skipDuplicates: true });

    await prisma.$transaction([
      prisma.collectorRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), status: "OK", itemsFound: raw.length, itemsNew: count },
      }),
      prisma.source.update({
        where: { id: source.id },
        data: { lastRunAt: new Date(), lastStatus: "OK", lastError: null, lastItemsNew: count },
      }),
    ]);
    return { sourceId: source.id, label: `${source.client.name} / ${source.name}`, ok: true, found: raw.length, inserted: count };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.$transaction([
      prisma.collectorRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), status: "ERROR", error: truncate(message, 2000) },
      }),
      prisma.source.update({
        where: { id: source.id },
        // lastRunAt still advances so a broken source doesn't retry every tick.
        data: { lastRunAt: new Date(), lastStatus: "ERROR", lastError: truncate(message, 2000), lastItemsNew: 0 },
      }),
    ]);
    return { sourceId: source.id, label: `${source.client.name} / ${source.name}`, ok: false, found: 0, inserted: 0, error: message };
  }
}

export async function dueSources(now = new Date()) {
  const sources = await prisma.source.findMany({ where: { enabled: true }, include: { client: true } });
  return sources.filter((s) => !s.lastRunAt || s.lastRunAt.getTime() + s.intervalMinutes * 60_000 <= now.getTime());
}

export async function runDueSources(concurrency = 3): Promise<RunResult[]> {
  const queue = await dueSources();
  const results: RunResult[] = [];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) results.push(await runLoadedSource(s));
  });
  await Promise.all(workers);
  return results;
}
