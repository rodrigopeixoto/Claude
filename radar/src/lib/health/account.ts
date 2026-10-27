import type { HealthComponent } from "./score";

/**
 * Account health: crosses reputation (what people say), the stock (what investors do, net of the
 * market index) and the strategic reading (churn risk and expansion potential for the agency).
 */
export type Nivel = "baixo" | "medio" | "alto";
export type Polaridade = "neg" | "pos" | "neu";

export interface AccountInput {
  reputation: number | null;
  reputationComponents: HealthComponent[];
  mentions7d: number;
  negative7d: number;
  rating: { avg: number; count: number } | null;
  stock: {
    ret7: number | null;
    ret30: number | null;
    ex30: number | null;
    ex90: number | null;
    bench7: number | null;
    benchName: string | null;
  } | null;
  strategy: { churn: Nivel; expansion: Nivel; churnWhy: string[]; expansionWhy: string[] } | null;
}

export interface AccountComponent {
  key: "reputacao" | "mercado" | "estrategico";
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface AccountHealth {
  score: number | null;
  components: AccountComponent[];
  motivos: { polaridade: Polaridade; texto: string }[];
}

const WEIGHTS = { reputacao: 0.35, mercado: 0.15, estrategico: 0.5 };
const CHURN_SCORE: Record<Nivel, number> = { alto: 15, medio: 55, baixo: 90 };
const EXPANSION_BONUS: Record<Nivel, number> = { alto: 10, medio: 0, baixo: -5 };
const NIVEL_LABEL: Record<Nivel, string> = { baixo: "baixo", medio: "médio", alto: "alto" };
const NIVEL_LABEL_F: Record<Nivel, string> = { baixo: "baixa", medio: "média", alto: "alta" };

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1).replace(".", ",")}%`;
const num = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

export function marketScore(ex30: number | null, ex90: number | null): number | null {
  const parts = [ex30, ex90].filter((v): v is number => v != null);
  if (!parts.length) return null;
  const m = parts.reduce((a, b) => a + b, 0) / parts.length;
  return clamp(70 + m * 150);
}

/** How a 7-day stock move compares with its index, in words. */
export function describeMove(ret: number, bench: number | null, benchName: string | null): { polaridade: Polaridade; texto: string } {
  if (bench == null || !benchName) {
    return { polaridade: ret < 0 ? "neg" : "pos", texto: `Ação ${pct(ret)} em 7 dias` };
  }
  const excess = ret - bench;
  const base = `Ação ${pct(ret)} em 7 dias; ${benchName} ${pct(bench)}`;
  // On a big market day, tolerate a proportional gap (higher-beta stocks fall more than the index).
  const tolerance = Math.max(0.03, 0.4 * Math.abs(bench));
  if (excess >= 0.03) return { polaridade: "pos", texto: `${base}: ${pct(excess)} melhor que o mercado` };
  if (ret < 0 && excess > -tolerance) return { polaridade: "neu", texto: `${base}: queda explicada pelo mercado` };
  if (excess <= -tolerance) return { polaridade: "neg", texto: `${base}: ${pct(excess).replace("+", "")} pior que o mercado` };
  return { polaridade: "neu", texto: `${base}: em linha com o mercado` };
}

export function computeAccountHealth(input: AccountInput): AccountHealth {
  const components: AccountComponent[] = [];
  const motivos: AccountHealth["motivos"] = [];

  if (input.strategy) {
    const { churn, expansion, churnWhy, expansionWhy } = input.strategy;
    components.push({
      key: "estrategico",
      label: "Leitura estratégica",
      score: clamp(CHURN_SCORE[churn] + EXPANSION_BONUS[expansion]),
      weight: WEIGHTS.estrategico,
      detail: `risco de cancelamento ${NIVEL_LABEL[churn]}, expansão ${NIVEL_LABEL_F[expansion]}`,
    });
    if (churn !== "baixo") motivos.push({ polaridade: "neg", texto: `Risco de cancelamento ${NIVEL_LABEL[churn]}: ${churnWhy[0] ?? "ver leitura"}` });
    if (expansion === "alto") motivos.push({ polaridade: "pos", texto: `Potencial de expansão alto: ${expansionWhy[0] ?? "ver leitura"}` });
  }

  if (input.reputation != null) {
    components.push({
      key: "reputacao",
      label: "Reputação",
      score: input.reputation,
      weight: WEIGHTS.reputacao,
      detail: `${input.mentions7d} menções em 7 dias, ${input.negative7d} negativas`,
    });
    if (input.rating && input.rating.count >= 3) {
      const r = input.rating;
      motivos.push({
        polaridade: r.avg < 3.5 ? "neg" : r.avg >= 4.2 ? "pos" : "neu",
        texto: `Nota ${num(r.avg)}★ nas lojas (${r.count} avaliações em 30 dias)`,
      });
    }
    if (input.mentions7d > 0) {
      const share = input.negative7d / input.mentions7d;
      if (share >= 0.15) motivos.push({ polaridade: "neg", texto: `${input.negative7d} de ${input.mentions7d} menções negativas em 7 dias (${Math.round(share * 100)}%)` });
    }
    const sent = input.reputationComponents.find((c) => c.key === "sentiment");
    if (sent && sent.score < 50) motivos.push({ polaridade: "neg", texto: `Sentimento médio negativo (${Math.round(sent.score)} de 100)` });
    const risk = input.reputationComponents.find((c) => c.key === "risk");
    if (risk && risk.score < 70) motivos.push({ polaridade: "neg", texto: `Menções graves: ${risk.detail}` });
  }

  if (input.stock) {
    const s = input.stock;
    const ms = marketScore(s.ex30, s.ex90);
    if (ms != null) {
      components.push({
        key: "mercado",
        label: "Bolsa vs. índice",
        score: ms,
        weight: WEIGHTS.mercado,
        detail: `diferença para ${s.benchName ?? "o índice"}: 30 dias ${s.ex30 == null ? "n/d" : pct(s.ex30)}, 90 dias ${s.ex90 == null ? "n/d" : pct(s.ex90)}`,
      });
    }
    if (s.ret7 != null && Math.abs(s.ret7) >= 0.05) motivos.push(describeMove(s.ret7, s.bench7, s.benchName));
    else if (s.ex30 != null && Math.abs(s.ex30) >= 0.08) {
      motivos.push({ polaridade: s.ex30 < 0 ? "neg" : "pos", texto: `Ação ${pct(s.ret30 ?? 0)} em 30 dias, ${pct(s.ex30)} vs. ${s.benchName}` });
    }
  }

  const order: Record<Polaridade, number> = { neg: 0, neu: 1, pos: 2 };
  motivos.sort((a, b) => order[a.polaridade] - order[b.polaridade]);
  if (!motivos.length && components.length) motivos.push({ polaridade: "pos", texto: "Sem sinais negativos relevantes" });

  if (!components.length) return { score: null, components, motivos: [{ polaridade: "neu", texto: "Sem dados: confirmar o cliente e configurar fontes" }] };
  const total = components.reduce((a, c) => a + c.weight, 0);
  const score = Math.round((components.reduce((a, c) => a + c.score * c.weight, 0) / total) * 10) / 10;
  return {
    score,
    components: components.map((c) => ({ ...c, score: Math.round(c.score * 10) / 10, weight: Math.round((c.weight / total) * 100) / 100 })),
    motivos,
  };
}
