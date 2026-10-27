"use client";

import { useState } from "react";
import { fmtDay, useWidth } from "./useWidth";

interface Point {
  date: string;
  score: number | null;
}

const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 32 };

/** Health score over time — single series, fixed 0–100 axis, crosshair tooltip. */
export function TrendChart({ points }: { points: Point[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-3">Sem histórico ainda — o score diário aparece aqui.</p>;
  }
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const x = (i: number) => PAD.left + (points.length > 1 ? i * step : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (v / 100) * innerH;
  // Gaps (days without a score) break the line instead of interpolating across them.
  let d = "";
  points.forEach((p, i) => {
    if (p.score == null) return;
    const continues = i > 0 && points[i - 1].score != null;
    d += `${continues ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`;
  });
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(innerW / 70)));
  const h = hover != null ? points[hover] : null;

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      <svg
        className="block"
        width={width}
        height={H}
        role="img"
        aria-label="Score de saúde nos últimos 30 dias"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const i = Math.round((e.clientX - box.left - PAD.left) / (step || 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
              {fmtDay(p.date)}
            </text>
          ) : null,
        )}
        <path d={d} fill="none" stroke="var(--seq)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 2 &&
          points.map((p, i) => p.score != null && <circle key={i} cx={x(i)} cy={y(p.score)} r="4" fill="var(--seq)" />)}
        {h && hover != null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--text-muted)" strokeDasharray="3 3" />
            {h.score != null && (
              <circle cx={x(hover)} cy={y(h.score)} r="5" fill="var(--seq)" stroke="var(--surface-1)" strokeWidth="2" />
            )}
          </>
        )}
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-line bg-surface-1 px-2 py-1 text-xs shadow-sm"
          style={{ left: Math.min(width - 110, Math.max(0, x(hover) + 8)) }}
        >
          <div className="text-ink-3">{fmtDay(h.date)}</div>
          <div className="font-medium">{h.score == null ? "sem dados" : `Score ${Math.round(h.score)}`}</div>
        </div>
      )}
    </div>
  );
}
