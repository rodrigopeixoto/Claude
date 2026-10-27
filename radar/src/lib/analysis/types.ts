import type { Channel, SentimentLabel } from "@prisma/client";

export const TOPICS = [
  "atendimento",
  "preco_cobranca",
  "produto",
  "bug_tecnico",
  "entrega_prazo",
  "fraude_seguranca",
  "institucional",
  "resultados_financeiros",
  "pessoas_cultura",
  "marketing_campanha",
  "elogio",
  "outro",
] as const;
export type Topic = (typeof TOPICS)[number];

export interface MentionInput {
  id: string;
  channel: Channel;
  title: string | null;
  content: string;
  rating: number | null;
}

export interface Analysis {
  relevant: boolean;
  sentiment: number;
  sentimentLabel: SentimentLabel;
  topic: Topic;
  /** 0 = nenhum risco, 1 = baixo, 2 = médio, 3 = crítico (crise, fraude, jurídico, imprensa negativa forte). */
  severity: number;
  isComplaint: boolean;
  summary: string;
  method: "llm" | "heuristic";
}

export function labelFor(sentiment: number): SentimentLabel {
  if (sentiment <= -0.25) return "NEGATIVE";
  if (sentiment >= 0.25) return "POSITIVE";
  return "NEUTRAL";
}
