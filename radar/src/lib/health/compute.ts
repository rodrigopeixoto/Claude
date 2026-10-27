import { Prisma } from "@prisma/client";
import { raiseHealthAlerts } from "../alerts";
import { prisma } from "../db";
import { computeHealth } from "./score";

const DAY = 24 * 3600_000;

export function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Computes and stores the snapshot for `asOf`'s day, using windows that end at `asOf`. */
export async function snapshotClient(clientId: string, asOf = new Date()) {
  const end = asOf;
  const recentStart = new Date(end.getTime() - 7 * DAY);
  const baselineStart = new Date(recentStart.getTime() - 28 * DAY);
  const base = { clientId, relevant: true, analyzedAt: { not: null } } satisfies Prisma.MentionWhereInput;

  const [recent, baselineNegatives, olderCount, ratings] = await Promise.all([
    prisma.mention.findMany({
      where: { ...base, publishedAt: { gt: recentStart, lte: end } },
      select: { sentiment: true, engagement: true, isComplaint: true, severity: true },
    }),
    prisma.mention.count({
      where: { ...base, sentimentLabel: "NEGATIVE", publishedAt: { gt: baselineStart, lte: recentStart } },
    }),
    prisma.mention.count({ where: { ...base, publishedAt: { lte: recentStart } } }),
    prisma.mention.findMany({
      where: { ...base, rating: { not: null }, publishedAt: { gt: new Date(end.getTime() - 30 * DAY), lte: end } },
      select: { rating: true },
    }),
  ]);

  const health = computeHealth({
    recent: recent.map((m) => ({
      sentiment: m.sentiment ?? 0,
      engagement: m.engagement,
      isComplaint: m.isComplaint ?? false,
      severity: m.severity ?? 0,
    })),
    baselineNegativePerWeek: olderCount >= 10 ? baselineNegatives / 4 : null,
    ratings30d: ratings.map((r) => r.rating!),
  });

  const date = startOfDayUtc(asOf);
  const avgRating = ratings.length ? ratings.reduce((a, r) => a + r.rating!, 0) / ratings.length : null;
  const data = {
    score: health.score,
    components: health.components as unknown as Prisma.InputJsonValue,
    mentions7d: recent.length,
    negative7d: health.negativeCount,
    complaints7d: recent.filter((m) => m.isComplaint).length,
    avgRating30d: avgRating,
  };
  const snapshot = await prisma.healthSnapshot.upsert({
    where: { clientId_date: { clientId, date } },
    create: { clientId, date, ...data },
    update: data,
  });
  return { snapshot, health };
}

export async function refreshHealth(clientIds?: Iterable<string>) {
  const ids = clientIds ? [...clientIds] : (await prisma.client.findMany({ select: { id: true } })).map((c) => c.id);
  for (const id of ids) {
    const { snapshot, health } = await snapshotClient(id);
    await raiseHealthAlerts(id, snapshot, health.spikeRatio);
  }
}
