import type { HealthSnapshot } from "@prisma/client";
import { prisma } from "./db";
import { truncate } from "./text";

const DAY = 24 * 3600_000;

async function notify(clientName: string, title: string, detail?: string | null, url?: string | null) {
  const hook = process.env.ALERT_WEBHOOK_URL;
  if (!hook) return;
  const text = `*[Radar] ${clientName}* — ${title}${detail ? `\n${detail}` : ""}${url ? `\n${url}` : ""}`;
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error(`[alerts] webhook falhou: ${err instanceof Error ? err.message : err}`);
  }
}

async function createAlert(data: {
  clientId: string;
  clientName: string;
  kind: "SEVERE_MENTION" | "VOLUME_SPIKE" | "SCORE_DROP";
  dedupeKey: string;
  title: string;
  detail?: string;
  mentionId?: string;
  url?: string | null;
}) {
  const { count } = await prisma.alert.createMany({
    data: [
      {
        clientId: data.clientId,
        kind: data.kind,
        dedupeKey: data.dedupeKey,
        title: data.title,
        detail: data.detail,
        mentionId: data.mentionId,
      },
    ],
    skipDuplicates: true,
  });
  if (count > 0) await notify(data.clientName, data.title, data.detail, data.url);
}

/** One alert per critical mention (severity 3) published in the last 3 days. */
export async function raiseSevereMentionAlerts() {
  const mentions = await prisma.mention.findMany({
    where: {
      relevant: true,
      severity: { gte: 3 },
      publishedAt: { gte: new Date(Date.now() - 3 * DAY) },
      alerts: { none: {} },
    },
    include: { client: { select: { name: true } } },
    take: 50,
  });
  for (const m of mentions) {
    await createAlert({
      clientId: m.clientId,
      clientName: m.client.name,
      kind: "SEVERE_MENTION",
      dedupeKey: `mention:${m.id}`,
      title: truncate(m.summary || m.title || m.content, 200),
      detail: `Menção crítica (${m.channel}${m.author ? ` · ${m.author}` : ""})`,
      mentionId: m.id,
      url: m.url,
    });
  }
}

export async function raiseHealthAlerts(clientId: string, snapshot: HealthSnapshot, spikeRatio: number | null) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } });
  const day = snapshot.date.toISOString().slice(0, 10);

  if (spikeRatio != null && spikeRatio >= 2.5 && snapshot.negative7d >= 5) {
    await createAlert({
      clientId,
      clientName: client.name,
      kind: "VOLUME_SPIKE",
      dedupeKey: `spike:${day}`,
      title: `Pico de menções negativas: ${snapshot.negative7d} em 7 dias (${spikeRatio.toFixed(1)}× a média)`,
    });
  }

  const weekAgo = await prisma.healthSnapshot.findFirst({
    where: { clientId, date: { lte: new Date(snapshot.date.getTime() - 7 * DAY) } },
    orderBy: { date: "desc" },
  });
  if (snapshot.score != null && weekAgo?.score != null && weekAgo.score - snapshot.score >= 10) {
    await createAlert({
      clientId,
      clientName: client.name,
      kind: "SCORE_DROP",
      dedupeKey: `score:${day}`,
      title: `Saúde caiu ${(weekAgo.score - snapshot.score).toFixed(0)} pontos em 7 dias (${weekAgo.score.toFixed(0)} → ${snapshot.score.toFixed(0)})`,
    });
  }
}
