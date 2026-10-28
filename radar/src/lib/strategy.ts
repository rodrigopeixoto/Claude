import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { parseFeed } from "./collectors/rssParse";
import { prisma } from "./db";
import type { HealthComponent } from "./health/score";
import { CHANNEL_LABELS } from "./sourceTemplates";
import { getStock } from "./stocks";
import { truncate } from "./text";

const DAY = 24 * 3600_000;

const Nivel = z.enum(["baixo", "medio", "alto"]);

export const StrategySchema = z.object({
  leitura_macro: z.string(),
  leitura_segmento: z.string(),
  leitura_cliente: z.string(),
  risco_cancelamento: z.object({ nivel: Nivel, motivos: z.array(z.string()) }),
  potencial_expansao: z.object({ nivel: Nivel, motivos: z.array(z.string()) }),
  impacto_ux: z.object({ outsourcing: z.string(), hunting: z.string() }),
  sinais: z.array(
    z.object({
      tipo: z.enum(["negativo", "atencao", "positivo"]),
      titulo: z.string(),
      evidencia: z.string(),
      impacto: z.string(),
      plano_acao: z.array(z.string()),
      prazo: z.string(),
      responsavel: z.string(),
      /** Links to where the evidence came from (news, filings, store pages, quotes). */
      fontes: z.array(z.string()).optional(),
    }),
  ),
  /** Publication ideas tying the client's segment and news to UX, hunting and outsourcing. */
  sugestoes_conteudo: z
    .array(
      z.object({
        formato: z.string(),
        titulo: z.string(),
        gancho: z.string(),
        pauta: z.string(),
        argumento: z.string(),
        cta: z.string(),
      }),
    )
    .optional(),
});
export type Strategy = z.infer<typeof StrategySchema>;

const AGENCY =
  process.env.AGENCY_CONTEXT ||
  "Agência de UX que (1) faz outsourcing de UX designers, alocando profissionais dentro dos times dos clientes, e (2) faz hunting (recrutamento) de profissionais de UX para os clientes.";

const SYSTEM = `Você é estrategista de negócios de uma agência. ${AGENCY}
Você recebe os dados que o Radar coletou sobre um cliente da agência e o noticiário recente do mercado e do segmento dele. Faça uma leitura objetiva, em português do Brasil:
- leitura_macro: o que o cenário macroeconômico do mercado do cliente significa para ele agora (2 a 4 frases).
- leitura_segmento: como está o segmento/nicho do cliente (2 a 4 frases).
- leitura_cliente: o que os dados do próprio cliente mostram (reputação, ações na bolsa, notícias), cruzando com macro e segmento (3 a 5 frases).
- risco_cancelamento: chance de o cliente cortar ou cancelar o contrato com a agência, com motivos concretos.
- potencial_expansao: chance de ampliar o contrato (mais designers alocados, mais vagas de hunting), com motivos concretos.
- impacto_ux: o que isso significa para a operação de outsourcing e para a de hunting de UX nesse cliente.
- sinais: de 3 a 7 sinais. Cada um com evidência (cite o dado ou a manchete com a data), impacto na operação da agência e, para todo sinal negativo ou de atenção, um plano de ação com passos práticos, prazo e responsável sugerido (ex.: diretor de contas, head de talentos). Para sinais positivos, o plano descreve como aproveitar a oportunidade.
- sugestoes_conteudo: de 2 a 3 pautas de publicação para a agência (post de LinkedIn, artigo, carrossel, webinar), com olhar de head de UX estrategista. Cada uma liga o segmento e as notícias do cliente a UX, hunting e outsourcing e mostra um benefício ou quebra uma objeção a contratar profissionais de UX. Campos: formato, titulo, gancho (o fato do segmento ou notícia que motiva a pauta), pauta (o que dizer), argumento (benefício ou objeção quebrada) e cta (chamada para ação). Nunca exponha problemas do cliente publicamente: use o tema do segmento.
Use apenas os dados fornecidos e conhecimento geral estável; não invente números nem fatos. Quando faltar dado, diga que falta e o que coletar.`;

const MACRO_QUERIES: Record<string, { q: string; hl: string; gl: string; ceid: string }> = {
  BR: { q: "Selic OR IPCA OR Ibovespa OR dólar OR PIB", hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" },
  GB: { q: "\"Bank of England\" OR \"UK inflation\" OR \"UK economy\"", hl: "en-GB", gl: "GB", ceid: "GB:en" },
  ZA: { q: "SARB OR rand OR \"South Africa economy\"", hl: "en-ZA", gl: "ZA", ceid: "ZA:en" },
  PT: { q: "BCE OR \"economia portuguesa\" OR inflação Portugal", hl: "pt-PT", gl: "PT", ceid: "PT:pt-150" },
  GLOBAL: { q: "\"global economy\" OR \"Federal Reserve\" OR ECB", hl: "en-GB", gl: "GB", ceid: "GB:en" },
};

async function headlines(q: string, loc: { hl: string; gl: string; ceid: string }, days = 30, max = 15) {
  try {
    const params = new URLSearchParams({ q: `${q} when:${days}d`, ...loc });
    const res = await fetch(`https://news.google.com/rss/search?${params}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    return parseFeed(await res.text())
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, max)
      .map((e) => `${e.publishedAt.toISOString().slice(0, 10)} — ${e.title}`);
  } catch {
    return [];
  }
}

const pct = (v: number | null) => (v == null ? "n/d" : `${(v * 100).toFixed(1)}%`);

export async function buildContext(clientId: string): Promise<string> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, include: { sources: true } });
  const since90 = new Date(Date.now() - 90 * DAY);
  const since30 = new Date(Date.now() - 30 * DAY);
  const [snapshot, channels, negatives, news, stock] = await Promise.all([
    prisma.healthSnapshot.findFirst({ where: { clientId }, orderBy: { date: "desc" } }),
    prisma.mention.groupBy({
      by: ["channel", "sentimentLabel"],
      where: { clientId, relevant: true, publishedAt: { gte: since30 } },
      _count: { _all: true },
    }),
    prisma.mention.findMany({
      where: { clientId, relevant: true, sentimentLabel: "NEGATIVE", publishedAt: { gte: since30 } },
      orderBy: [{ severity: "desc" }, { publishedAt: "desc" }],
      take: 15,
    }),
    prisma.mention.findMany({
      where: { clientId, relevant: true, channel: "NEWS", publishedAt: { gte: since90 } },
      orderBy: { publishedAt: "desc" },
      take: 60,
    }),
    client.ticker ? getStock(client.ticker, client.market) : Promise.resolve(null),
  ]);
  const loc = MACRO_QUERIES[client.market ?? "GLOBAL"] ?? MACRO_QUERIES.GLOBAL;
  const [macro, segment] = await Promise.all([
    headlines(loc.q, loc),
    client.segment ? headlines(client.segment, loc) : Promise.resolve([]),
  ]);

  const comps = ((snapshot?.components ?? []) as unknown as HealthComponent[])
    .map((c) => `${c.label}: ${c.score} (${c.detail})`)
    .join("; ");
  const chan = new Map<string, Record<string, number>>();
  for (const g of channels) {
    const row = chan.get(g.channel) ?? {};
    row[g.sentimentLabel ?? "NEUTRAL"] = g._count._all;
    chan.set(g.channel, row);
  }

  return [
    `# Cliente: ${client.name}`,
    `Descrição: ${client.description ?? "n/d"} | Mercado: ${client.market ?? "n/d"} | Segmento: ${client.segment ?? "n/d"}`,
    `Fontes monitoradas: ${client.sources.map((s) => s.name).join(", ") || "nenhuma"}`,
    `\n## Saúde de reputação (janela 7 dias)`,
    snapshot
      ? `Score ${snapshot.score?.toFixed(1) ?? "n/d"} de 100; menções 7d ${snapshot.mentions7d}, negativas ${snapshot.negative7d}, reclamações ${snapshot.complaints7d}, nota das lojas 30d ${snapshot.avgRating30d?.toFixed(2) ?? "n/d"}. Componentes: ${comps || "n/d"}`
      : "Sem dados.",
    `\n## Menções por canal (30 dias)`,
    [...chan].map(([ch, r]) => `${CHANNEL_LABELS[ch] ?? ch}: ${r.POSITIVE ?? 0} positivas, ${r.NEUTRAL ?? 0} neutras, ${r.NEGATIVE ?? 0} negativas`).join("\n") || "Nenhuma.",
    `\n## Ações na bolsa`,
    stock
      ? `${stock.ticker}, último ${stock.last.toFixed(2)} ${stock.currency} em ${stock.asOf.toISOString().slice(0, 10)}. Variação: 7d ${pct(stock.returns[7])}, 30d ${pct(stock.returns[30])}, 60d ${pct(stock.returns[60])}, 90d ${pct(stock.returns[90])}, 365d ${pct(stock.returns[365])}.`
      : "Empresa sem ações listadas monitoradas.",
    `\n## Menções negativas mais graves (30 dias)`,
    negatives.map((m) => `- ${m.publishedAt.toISOString().slice(0, 10)} [${CHANNEL_LABELS[m.channel]}${m.rating != null ? `, nota ${m.rating}` : ""}] ${truncate(m.title ?? m.content, 220)}`).join("\n") || "Nenhuma.",
    `\n## Notícias sobre o cliente (90 dias, mais recentes primeiro)`,
    news.map((m) => `- ${m.publishedAt.toISOString().slice(0, 10)} ${m.author ? `(${m.author}) ` : ""}${truncate(m.title ?? m.content, 200)}`).join("\n") || "Nenhuma.",
    `\n## Manchetes macroeconômicas do mercado ${client.market ?? ""} (30 dias)`,
    macro.join("\n") || "Não coletadas.",
    `\n## Manchetes do segmento "${client.segment ?? ""}" (30 dias)`,
    segment.join("\n") || "Não coletadas.",
  ].join("\n");
}

let anthropic: Anthropic | null = null;

/** Writes a new strategic reading for the client with Claude and stores it. */
export async function generateStrategy(clientId: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Configure ANTHROPIC_API_KEY no .env para gerar a leitura estratégica.");
  anthropic ??= new Anthropic();
  const context = await buildContext(clientId);
  const model = process.env.STRATEGY_MODEL || "claude-opus-5-5";
  const response = await anthropic.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(StrategySchema) },
    messages: [{ role: "user", content: `Data de hoje: ${new Date().toISOString().slice(0, 10)}\n\n${context}` }],
  });
  if (response.stop_reason === "refusal") throw new Error("O modelo recusou gerar a leitura para este cliente.");
  const data = response.parsed_output;
  if (!data) throw new Error(`Resposta do modelo sem o formato esperado (stop_reason=${response.stop_reason}).`);
  return prisma.strategicReport.create({ data: { clientId, model: response.model, data: data as object } });
}

export async function latestStrategy(clientId: string) {
  const r = await prisma.strategicReport.findFirst({ where: { clientId }, orderBy: { createdAt: "desc" } });
  return r ? { ...r, data: StrategySchema.parse(r.data) } : null;
}
