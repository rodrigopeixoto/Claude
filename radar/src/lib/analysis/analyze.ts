import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";
import { raiseSevereMentionAlerts } from "../alerts";
import { analyzeHeuristic } from "./heuristic";
import { analyzeWithLlm, llmEnabled } from "./llm";
import type { Analysis, MentionInput } from "./types";

const BATCH_SIZE = 20;

/** Classifies pending mentions; returns the ids of clients that got new analyses. */
export async function analyzePending(limit = 400): Promise<Set<string>> {
  const pending = await prisma.mention.findMany({
    where: { analyzedAt: null },
    orderBy: { collectedAt: "asc" },
    take: limit,
    include: { client: { select: { id: true, name: true, description: true, keywords: true } } },
  });
  const touched = new Set<string>();
  const byClient = new Map<string, typeof pending>();
  for (const m of pending) byClient.set(m.clientId, [...(byClient.get(m.clientId) ?? []), m]);

  for (const [clientId, mentions] of byClient) {
    for (let i = 0; i < mentions.length; i += BATCH_SIZE) {
      const batch = mentions.slice(i, i + BATCH_SIZE);
      const inputs: MentionInput[] = batch.map((m) => ({
        id: m.id,
        channel: m.channel,
        title: m.title,
        content: m.content,
        rating: m.rating,
      }));

      let results = new Map<string, Analysis>();
      if (llmEnabled()) {
        try {
          results = await analyzeWithLlm(batch[0].client, inputs);
        } catch (err) {
          // Transient failures leave the batch pending for the next tick instead of
          // locking in the weaker heuristic result.
          if (
            err instanceof Anthropic.RateLimitError ||
            err instanceof Anthropic.InternalServerError ||
            err instanceof Anthropic.APIConnectionError
          ) {
            console.error(`[analyze] LLM indisponível, tentando de novo no próximo ciclo: ${err.message}`);
            continue;
          }
          console.error(`[analyze] LLM falhou, usando heurística: ${err instanceof Error ? err.message : err}`);
        }
      }

      const now = new Date();
      await prisma.$transaction(
        inputs.map((input) => {
          const a = results.get(input.id) ?? analyzeHeuristic(input);
          return prisma.mention.update({
            where: { id: input.id },
            data: {
              analyzedAt: now,
              analysisMethod: a.method,
              relevant: a.relevant,
              sentiment: a.sentiment,
              sentimentLabel: a.sentimentLabel,
              topic: a.topic,
              severity: a.severity,
              isComplaint: a.isComplaint,
              summary: a.summary,
            },
          });
        }),
      );
      touched.add(clientId);
    }
  }
  if (touched.size > 0) await raiseSevereMentionAlerts();
  return touched;
}
