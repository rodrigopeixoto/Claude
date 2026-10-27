import { scoreBand } from "@/lib/health/score";

const ICONS = {
  good: "M5 12l4 4 10-10",
  warning: "M12 8v5M12 16.5v.5",
  serious: "M12 7v6M12 16.5v.5",
  critical: "M7 7l10 10M17 7 7 17",
  none: "M6 12h12",
} as const;

const COLOR = {
  good: "var(--good)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--critical)",
  none: "var(--text-muted)",
} as const;

/** Status is never color-only: icon + label travel with it. */
export function StatusChip({ score }: { score: number | null }) {
  const band = scoreBand(score);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="11" fill={COLOR[band.status]} />
        <path d={ICONS[band.status]} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
      {band.label}
    </span>
  );
}

export function ScoreNumber({ score, size = "lg" }: { score: number | null; size?: "lg" | "xl" }) {
  return (
    <span className={size === "xl" ? "text-5xl font-semibold tracking-tight" : "text-4xl font-semibold tracking-tight"}>
      {score == null ? "—" : Math.round(score)}
    </span>
  );
}

export function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-ink-3">sem histórico de 7d</span>;
  const rounded = Math.round(value);
  const arrow = rounded > 0 ? "▲" : rounded < 0 ? "▼" : "■";
  return (
    <span className="text-xs text-ink-2">
      {arrow} {rounded > 0 ? "+" : ""}
      {rounded} em 7d
    </span>
  );
}
