import { Prisma, type Channel, type SentimentLabel } from "@prisma/client";
import { prisma } from "./db";
import { computeAccountHealth, type AccountHealth } from "./health/account";
import { explainScore } from "./health/explain";
import type { HealthComponent } from "./health/score";
import { getStock } from "./stocks";
import { latestStrategy } from "./strategy";

const DAY = 24 * 3600_000;

/** Store ratings over the last 30 days, overall and per store. */
export async function storeRatings(clientId: string) {
  const rows = await prisma.mention.groupBy({
    by: ["channel"],
    where: { clientId, relevant: true, rating: { not: null }, publishedAt: { gte: new Date(Date.now() - 30 * DAY) } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = rows.reduce((a, r) => a + r._count._all, 0);
  const avg = count ? rows.reduce((a, r) => a + (r._avg.rating ?? 0) * r._count._all, 0) / count : null;
  return { avg, count, byStore: rows.map((r) => ({ channel: r.channel, avg: r._avg.rating, count: r._count._all })) };
}

type Snapshot = { score: number | null; components: Prisma.JsonValue; mentions7d: number; negative7d: number } | null;

export function accountHealthFor(
  latest: Snapshot,
  ratings: { avg: number | null; count: number },
  stock: Awaited<ReturnType<typeof getStock>>,
  strategy: Awaited<ReturnType<typeof latestStrategy>>,
): AccountHealth {
  return computeAccountHealth({
    reputation: latest?.score ?? null,
    reputationComponents: (latest?.components ?? []) as unknown as HealthComponent[],
    mentions7d: latest?.mentions7d ?? 0,
    negative7d: latest?.negative7d ?? 0,
    rating: ratings.avg != null ? { avg: ratings.avg, count: ratings.count } : null,
    stock: stock
      ? {
          ret7: stock.returns[7],
          ret30: stock.returns[30],
          ex30: stock.excess[30],
          ex90: stock.excess[90],
          bench7: stock.benchmark?.returns[7] ?? null,
          benchName: stock.benchmark?.name ?? null,
        }
      : null,
    strategy: strategy
      ? {
          churn: strategy.data.risco_cancelamento.nivel,
          expansion: strategy.data.potencial_expansao.nivel,
          churnWhy: strategy.data.risco_cancelamento.motivos,
          expansionWhy: strategy.data.potencial_expansao.motivos,
        }
      : null,
  });
}

export async function getOverview() {
  const since = new Date(Date.now() - 31 * DAY);
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      snapshots: { where: { date: { gte: since } }, orderBy: { date: "asc" } },
      _count: { select: { alerts: { where: { acknowledged: false } }, sources: true } },
      sources: { select: { lastStatus: true, enabled: true } },
    },
  });
  return Promise.all(clients.map(async (c) => {
    const latest = c.snapshots.at(-1) ?? null;
    const [stock, strategy, ratings] = await Promise.all([
      c.ticker ? getStock(c.ticker, c.market) : null,
      latestStrategy(c.id),
      storeRatings(c.id),
    ]);
    const weekAgo = [...c.snapshots].reverse().find((s) => latest && s.date.getTime() <= latest.date.getTime() - 7 * DAY);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      latest,
      delta: latest?.score != null && weekAgo?.score != null ? latest.score - weekAgo.score : null,
      trend: c.snapshots.map((s) => ({ date: s.date.toISOString().slice(0, 10), score: s.score })),
      openAlerts: c._count.alerts,
      sourceCount: c._count.sources,
      failingSources: c.sources.filter((s) => s.enabled && s.lastStatus === "ERROR").length,
      explain: explainScore(latest?.score ?? null, (latest?.components ?? []) as unknown as HealthComponent[]),
      ticker: c.ticker,
      stock30: stock?.returns[30] ?? null,
      churn: strategy?.data.risco_cancelamento.nivel ?? null,
      expansion: strategy?.data.potencial_expansao.nivel ?? null,
      ratings,
      account: accountHealthFor(latest, ratings, stock, strategy),
    };
  }));
}

export interface MentionFilters {
  /** Only mentions published in the last N days. */
  days?: number;
  channel?: Channel;
  sentiment?: SentimentLabel;
  q?: string;
  page?: number;
  showIrrelevant?: boolean;
}

export const PAGE_SIZE = 40;

export async function getClientDashboard(clientId: string, filters: MentionFilters) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  const since30 = new Date(Date.now() - 30 * DAY);

  const where: Prisma.MentionWhereInput = {
    clientId,
    ...(filters.showIrrelevant ? {} : { relevant: true }),
    ...(filters.days ? { publishedAt: { gte: new Date(Date.now() - filters.days * DAY) } } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.sentiment ? { sentimentLabel: filters.sentiment } : {}),
    ...(filters.q
      ? {
          OR: [
            { content: { contains: filters.q, mode: "insensitive" } },
            { title: { contains: filters.q, mode: "insensitive" } },
            { author: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const page = Math.max(1, filters.page ?? 1);

  const [snapshots, daily, channels, topics, alerts, mentions, total, sources] = await Promise.all([
    prisma.healthSnapshot.findMany({ where: { clientId, date: { gte: since30 } }, orderBy: { date: "asc" } }),
    prisma.$queryRaw<{ day: Date; label: SentimentLabel | null; n: bigint }[]>`
      SELECT date_trunc('day', "publishedAt") AS day, "sentimentLabel" AS label, count(*) AS n
      FROM "Mention"
      WHERE "clientId" = ${clientId} AND relevant AND "publishedAt" >= ${since30}
      GROUP BY 1, 2 ORDER BY 1`,
    prisma.$queryRaw<{ channel: Channel; n: bigint; neg: bigint; complaints: bigint; avg_sent: number | null; avg_rating: number | null }[]>`
      SELECT channel, count(*) AS n,
             count(*) FILTER (WHERE "sentimentLabel" = 'NEGATIVE') AS neg,
             count(*) FILTER (WHERE "isComplaint") AS complaints,
             avg(sentiment) AS avg_sent, avg(rating) AS avg_rating
      FROM "Mention"
      WHERE "clientId" = ${clientId} AND relevant AND "publishedAt" >= ${since30}
      GROUP BY channel ORDER BY n DESC`,
    prisma.mention.groupBy({
      by: ["topic"],
      where: { clientId, relevant: true, sentimentLabel: "NEGATIVE", publishedAt: { gte: since30 } },
      _count: { _all: true },
      orderBy: { _count: { topic: "desc" } },
      take: 8,
    }),
    prisma.alert.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.mention.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.mention.count({ where }),
    prisma.source.findMany({ where: { clientId }, select: { id: true, lastStatus: true, enabled: true } }),
  ]);

  const days = new Map<string, { date: string; POSITIVE: number; NEUTRAL: number; NEGATIVE: number }>();
  for (let t = since30.getTime(); t <= Date.now(); t += DAY) {
    const d = new Date(t).toISOString().slice(0, 10);
    days.set(d, { date: d, POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 });
  }
  for (const row of daily) {
    const d = days.get(row.day.toISOString().slice(0, 10));
    if (d) d[row.label ?? "NEUTRAL"] += Number(row.n);
  }

  const latest = snapshots.at(-1) ?? null;
  return {
    client,
    latest,
    components: (latest?.components ?? []) as unknown as HealthComponent[],
    trend: snapshots.map((s) => ({ date: s.date.toISOString().slice(0, 10), score: s.score })),
    daily: [...days.values()],
    channels: channels.map((c) => ({
      channel: c.channel,
      n: Number(c.n),
      neg: Number(c.neg),
      complaints: Number(c.complaints),
      avgSentiment: c.avg_sent,
      avgRating: c.avg_rating,
    })),
    topics: topics.map((t) => ({ topic: t.topic ?? "outro", n: t._count._all })),
    alerts,
    mentions,
    total,
    page,
    sourceCount: sources.length,
    failingSources: sources.filter((s) => s.enabled && s.lastStatus === "ERROR").length,
  };
}
