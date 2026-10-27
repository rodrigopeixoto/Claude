import type { Polaridade } from "@/lib/health/account";

const ICON: Record<Polaridade, string> = { neg: "▼", pos: "▲", neu: "•" };
const COLOR: Record<Polaridade, string> = { neg: "var(--critical)", pos: "var(--good)", neu: "var(--text-muted)" };

/** Up/down value with a colored arrow; the sign is also in the text, so color is never alone. */
export function Change({ value, unit = "%", digits = 1 }: { value: number | null; unit?: "%" | "pts"; digits?: number }) {
  if (value == null) return <span className="text-ink-3">—</span>;
  const shown = unit === "%" ? value * 100 : value;
  const pol: Polaridade = shown > 0.05 ? "pos" : shown < -0.05 ? "neg" : "neu";
  return (
    <span className="whitespace-nowrap">
      <span style={{ color: COLOR[pol] }} aria-hidden>{pol === "neu" ? "■" : ICON[pol]} </span>
      {shown > 0 ? "+" : ""}
      {shown.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}
      {unit === "%" ? "%" : ""}
    </span>
  );
}

export function Stars({ avg, count }: { avg: number | null; count?: number }) {
  if (avg == null) return <span className="text-ink-3">—</span>;
  return (
    <span className="whitespace-nowrap" title={count != null ? `${count} avaliações em 30 dias` : undefined}>
      {avg.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
      <span style={{ color: "var(--star)" }} aria-hidden> ★</span>
    </span>
  );
}

export function Motivos({ items, max = 3 }: { items: { polaridade: Polaridade; texto: string }[]; max?: number }) {
  return (
    <ul className="space-y-0.5 text-xs text-ink-2">
      {items.slice(0, max).map((m, i) => (
        <li key={i} className="flex gap-1.5">
          <span style={{ color: COLOR[m.polaridade] }} aria-hidden>{ICON[m.polaridade]}</span>
          <span>{m.texto}</span>
        </li>
      ))}
    </ul>
  );
}
