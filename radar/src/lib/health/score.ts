export interface MentionStat {
  sentiment: number;
  engagement: number | null;
  isComplaint: boolean;
  severity: number;
}

export interface HealthInput {
  /** Relevant, analyzed mentions from the last 7 days. */
  recent: MentionStat[];
  /** Average negative mentions per week over the 4 weeks before the recent window (null = no history). */
  baselineNegativePerWeek: number | null;
  /** Store ratings (1–5) from the last 30 days. */
  ratings30d: number[];
}

export interface HealthComponent {
  key: "sentiment" | "complaints" | "rating" | "risk" | "volume";
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface HealthResult {
  score: number | null;
  components: HealthComponent[];
  negativeCount: number;
  spikeRatio: number | null;
}

const WEIGHTS: Record<HealthComponent["key"], number> = {
  sentiment: 0.35,
  rating: 0.2,
  risk: 0.2,
  complaints: 0.15,
  volume: 0.1,
};
const MIN_SAMPLE = 3;

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * 0–100 reputation score. Each component is 0–100; components without enough data are
 * dropped and the remaining weights are renormalised, so a client with no apps isn't
 * penalised for missing ratings.
 */
export function computeHealth(input: HealthInput): HealthResult {
  const { recent } = input;
  const components: HealthComponent[] = [];
  const negativeCount = recent.filter((m) => m.sentiment <= -0.25).length;

  if (recent.length >= MIN_SAMPLE) {
    let wSum = 0;
    let sSum = 0;
    for (const m of recent) {
      const w = 1 + Math.log10(1 + Math.max(0, m.engagement ?? 0));
      wSum += w;
      sSum += w * m.sentiment;
    }
    const avg = sSum / wSum;
    components.push({
      key: "sentiment",
      label: "Sentimento",
      score: clamp(((avg + 1) / 2) * 100),
      weight: WEIGHTS.sentiment,
      detail: `média ponderada ${avg.toFixed(2)} em ${recent.length} menções`,
    });

    const complaints = recent.filter((m) => m.isComplaint).length;
    const share = complaints / recent.length;
    components.push({
      key: "complaints",
      label: "Reclamações",
      score: clamp(100 - share * 200),
      weight: WEIGHTS.complaints,
      detail: `${complaints} de ${recent.length} (${Math.round(share * 100)}%)`,
    });
  }

  if (input.ratings30d.length >= MIN_SAMPLE) {
    const avg = input.ratings30d.reduce((a, b) => a + b, 0) / input.ratings30d.length;
    components.push({
      key: "rating",
      label: "Nota nas lojas",
      score: clamp(((avg - 1) / 4) * 100),
      weight: WEIGHTS.rating,
      detail: `${avg.toFixed(2)}★ em ${input.ratings30d.length} avaliações (30d)`,
    });
  }

  if (recent.length > 0) {
    const critical = recent.filter((m) => m.severity >= 3).length;
    const high = recent.filter((m) => m.severity === 2).length;
    components.push({
      key: "risk",
      label: "Risco",
      // Penalty shrinks with volume: one critical item weighs more for a small brand than for a big one.
      score: clamp(100 - (critical * 30 + high * 10) / Math.max(1, Math.sqrt(recent.length / 10))),
      weight: WEIGHTS.risk,
      detail: `${critical} crítica(s), ${high} relevante(s)`,
    });
  }

  let spikeRatio: number | null = null;
  if (input.baselineNegativePerWeek != null && recent.length > 0) {
    spikeRatio = negativeCount / Math.max(1, input.baselineNegativePerWeek);
    components.push({
      key: "volume",
      label: "Pico de negativas",
      score: clamp(spikeRatio <= 1.2 ? 100 : 100 - (spikeRatio - 1.2) * 50),
      weight: WEIGHTS.volume,
      detail: `${negativeCount} negativas vs média ${input.baselineNegativePerWeek.toFixed(1)}/semana`,
    });
  }

  if (components.length === 0) return { score: null, components, negativeCount, spikeRatio };
  const totalWeight = components.reduce((a, c) => a + c.weight, 0);
  const score = components.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight;
  return {
    score: round(score),
    components: components.map((c) => ({ ...c, score: round(c.score), weight: round((c.weight / totalWeight) * 100) / 100 })),
    negativeCount,
    spikeRatio: spikeRatio == null ? null : round(spikeRatio),
  };
}

export function scoreBand(score: number | null): { label: string; status: "good" | "warning" | "serious" | "critical" | "none" } {
  if (score == null) return { label: "Sem dados", status: "none" };
  if (score >= 75) return { label: "Saudável", status: "good" };
  if (score >= 60) return { label: "Atenção", status: "warning" };
  if (score >= 45) return { label: "Risco", status: "serious" };
  return { label: "Crítico", status: "critical" };
}
