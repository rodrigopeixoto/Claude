import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CHANNEL_LABELS } from "../sourceTemplates";
import { truncate } from "../text";
import { TOPICS, labelFor, type Analysis, type MentionInput } from "./types";

const ResultSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int(),
      relevant: z.boolean(),
      sentiment: z.number(),
      topic: z.enum(TOPICS),
      severity: z.number().int(),
      is_complaint: z.boolean(),
      summary: z.string(),
    }),
  ),
});

const SYSTEM = `Você classifica menções públicas sobre uma empresa (cliente de uma agência) para um painel de reputação.
Para cada item numerado, devolva:
- relevant: false se o texto não trata da empresa monitorada (homônimo, citação incidental, spam); true caso contrário.
- sentiment: número de -1 (muito negativo para a empresa) a 1 (muito positivo). Avalie o impacto para a reputação da empresa, não o tom geral do texto. Notícia factual neutra = 0.
- topic: um de ${TOPICS.join(", ")}.
- severity: 0 sem risco; 1 insatisfação pontual; 2 problema relevante ou repercussão negativa em veículo; 3 risco de crise (fraude, vazamento, ação judicial, órgão regulador, acusação grave, viralização negativa).
- is_complaint: true se for reclamação de cliente/consumidor.
- summary: uma frase curta em português (máx. 20 palavras) dizendo o que aconteceu.
Devolva exatamente um resultado por item, com o mesmo index.`;

let client: Anthropic | null = null;

export function llmEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class LlmRefusalError extends Error {}

export async function analyzeWithLlm(
  company: { name: string; description: string | null; keywords: string[] },
  items: MentionInput[],
): Promise<Map<string, Analysis>> {
  client ??= new Anthropic();
  const listing = items
    .map((m, i) => {
      const rating = m.rating != null ? ` | nota ${m.rating}/5` : "";
      const text = truncate(`${m.title && !m.content.startsWith(m.title) ? `${m.title}. ` : ""}${m.content}`, 1500);
      return `[${i}] (${CHANNEL_LABELS[m.channel] ?? m.channel}${rating}) ${text}`;
    })
    .join("\n\n");

  const response = await client.messages.parse({
    model: process.env.LLM_MODEL || "claude-haiku-5-5",
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
    messages: [
      {
        role: "user",
        content: `Empresa monitorada: ${company.name}${company.description ? ` — ${company.description}` : ""}
Termos de busca: ${company.keywords.join(", ")}

Itens:
${listing}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new LlmRefusalError("LLM recusou o lote");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`Saída do LLM inválida (stop_reason=${response.stop_reason})`);

  const out = new Map<string, Analysis>();
  for (const r of parsed.results) {
    const item = items[r.index];
    if (!item) continue;
    const sentiment = Math.max(-1, Math.min(1, r.sentiment));
    out.set(item.id, {
      relevant: r.relevant,
      sentiment,
      sentimentLabel: labelFor(sentiment),
      topic: r.topic,
      severity: Math.max(0, Math.min(3, r.severity)),
      isComplaint: r.is_complaint,
      summary: truncate(r.summary, 300),
      method: "llm",
    });
  }
  return out;
}
