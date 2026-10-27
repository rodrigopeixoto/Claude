import { normalize, truncate } from "../text";
import { labelFor, type Analysis, type MentionInput, type Topic } from "./types";

// Small Portuguese lexicon — a fallback for when no LLM key is configured, not a replacement for it.
const POSITIVE = [
  "otimo", "excelente", "maravilhoso", "perfeito", "adoro", "amei", "recomendo", "melhor", "bom", "boa",
  "rapido", "facil", "parabens", "eficiente", "satisfeito", "incrivel", "resolveu", "resolvido", "lucro",
  "crescimento", "recorde", "premio", "premiado", "lider", "aprovado", "sucesso", "inovacao",
];
const NEGATIVE = [
  "pessimo", "horrivel", "ruim", "lixo", "odeio", "decepcao", "decepcionado", "nao funciona", "travando",
  "trava", "erro", "bug", "lento", "demora", "absurdo", "descaso", "cancelar", "cancelei", "cobranca indevida",
  "nao recebi", "atraso", "atrasado", "golpe", "fraude", "roubo", "vazamento", "processo", "procon",
  "reclamacao", "problema", "prejuizo", "queda", "demissao", "demissoes", "multa", "investigacao", "crise",
  "nao resolve", "sem resposta", "enganado", "pior", "bloqueado", "bloquearam", "instavel", "fora do ar",
];
const CRITICAL = [
  "golpe", "fraude", "vazamento", "procon", "processo judicial", "acao judicial", "policia", "investigacao",
  "crise", "boicote", "denuncia", "racismo", "assedio", "morte", "acidente", "falencia", "recuperacao judicial",
];
const TOPIC_RULES: [Topic, string[]][] = [
  ["fraude_seguranca", ["golpe", "fraude", "vazamento", "hacker", "seguranca", "clonado", "roubo"]],
  ["bug_tecnico", ["bug", "erro", "trava", "travando", "nao abre", "fora do ar", "instavel", "atualizacao", "crash", "lento"]],
  ["preco_cobranca", ["cobranca", "cobrado", "preco", "tarifa", "taxa", "juros", "fatura", "reembolso", "estorno"]],
  ["atendimento", ["atendimento", "atendente", "suporte", "sac", "chat", "resposta", "ouvidoria"]],
  ["entrega_prazo", ["entrega", "prazo", "atraso", "nao recebi", "pedido"]],
  ["resultados_financeiros", ["lucro", "receita", "balanco", "acoes", "trimestre", "ipo", "investimento", "resultado"]],
  ["pessoas_cultura", ["demissao", "demissoes", "contratacao", "vagas", "funcionarios", "ceo", "executivo"]],
  ["marketing_campanha", ["campanha", "patrocinio", "lancamento", "publicidade", "parceria"]],
];

function count(text: string, terms: string[]): number {
  const padded = ` ${text} `;
  return terms.reduce((n, t) => n + (padded.includes(` ${t} `) ? 1 : 0), 0);
}

export function analyzeHeuristic(m: MentionInput): Analysis {
  const text = normalize(`${m.title ?? ""} ${m.content}`);
  const pos = count(text, POSITIVE);
  const neg = count(text, NEGATIVE);
  const critical = count(text, CRITICAL);

  let sentiment = pos + neg === 0 ? 0 : (pos - neg) / (pos + neg);
  if (m.rating != null) {
    // Store ratings are the strongest signal we have: 1★ → -1, 3★ → 0, 5★ → +1.
    const fromRating = (m.rating - 3) / 2;
    sentiment = pos + neg === 0 ? fromRating : 0.7 * fromRating + 0.3 * sentiment;
  }
  sentiment = Math.max(-1, Math.min(1, sentiment));
  const label = labelFor(sentiment);

  const topic: Topic =
    TOPIC_RULES.find(([, terms]) => count(text, terms) > 0)?.[0] ?? (label === "POSITIVE" ? "elogio" : "outro");

  const isComplaint = m.channel === "RECLAME_AQUI" || (label === "NEGATIVE" && m.channel !== "NEWS");
  let severity = 0;
  if (label === "NEGATIVE") severity = 1;
  if (label === "NEGATIVE" && (m.channel === "NEWS" || neg >= 3)) severity = 2;
  if (critical > 0 && label !== "POSITIVE") severity = 3;

  return {
    relevant: true,
    sentiment: Math.round(sentiment * 100) / 100,
    sentimentLabel: label,
    topic,
    severity,
    isComplaint,
    summary: truncate(m.title || m.content, 160),
    method: "heuristic",
  };
}
