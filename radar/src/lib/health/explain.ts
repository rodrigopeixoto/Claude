import { scoreBand, type HealthComponent } from "./score";

const RANGES: Record<string, string> = {
  good: "75 a 100",
  warning: "60 a 74",
  serious: "45 a 59",
  critical: "abaixo de 45",
};

/** Plain-language reason for a client's band: which components pull the score down. */
export function explainScore(score: number | null, components: HealthComponent[]) {
  const band = scoreBand(score);
  if (score == null) return { faixa: band.label, motivo: "Sem dados suficientes nos últimos 7 dias." };
  const weak = [...components].filter((c) => c.score < 60).sort((a, b) => a.score - b.score).slice(0, 2);
  const motivo = weak.length
    ? `Puxado para baixo por ${weak.map((c) => `${c.label.toLowerCase()} (${Math.round(c.score)}: ${c.detail})`).join(" e ")}.`
    : "Nenhum componente abaixo de 60.";
  return { faixa: `${band.label} (${RANGES[band.status] ?? ""})`, motivo };
}
