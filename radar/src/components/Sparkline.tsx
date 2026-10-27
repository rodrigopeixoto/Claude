/** Decorative trend line for overview cards; the full interactive chart lives on the client page. */
export function Sparkline({ points, width = 120, height = 32 }: { points: (number | null)[]; width?: number; height?: number }) {
  const values = points.map((p, i) => [i, p] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (values.length < 2) return <div style={{ width, height }} />;
  const n = points.length - 1 || 1;
  const min = Math.min(...values.map((v) => v[1]), 40);
  const max = Math.max(...values.map((v) => v[1]), 90);
  const x = (i: number) => (i / n) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const d = values.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const [li, lv] = values.at(-1)!;
  return (
    <svg width={width} height={height} role="img" aria-label="Tendência de saúde em 30 dias">
      <path d={d} fill="none" stroke="var(--seq)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(li)} cy={y(lv)} r="3" fill="var(--seq)" stroke="var(--surface-1)" strokeWidth="2" />
    </svg>
  );
}
