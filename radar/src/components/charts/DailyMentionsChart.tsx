"use client";

import { useState } from "react";
import { fmtDay, useWidth } from "./useWidth";

interface Day {
  date: string;
  POSITIVE: number;
  NEUTRAL: number;
  NEGATIVE: number;
}

const H = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };
// Stack order: negative on the baseline so it's the easiest segment to compare day to day.
const SERIES = [
  { key: "NEGATIVE", label: "Negativas", color: "var(--neg)" },
  { key: "NEUTRAL", label: "Neutras", color: "var(--neu)" },
  { key: "POSITIVE", label: "Positivas", color: "var(--pos)" },
] as const;

function niceMax(v: number) {
  if (v <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

export function DailyMentionsChart({ days }: { days: Day[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = days.map((d) => d.POSITIVE + d.NEUTRAL + d.NEGATIVE);
  const max = niceMax(Math.max(1, ...totals));
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / days.length;
  const barW = Math.max(2, Math.min(18, band - 2));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const labelEvery = Math.ceil(days.length / Math.max(2, Math.floor(innerW / 70)));
  const h = hover != null ? days[hover] : null;

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg className="block" width={width} height={H} role="img" aria-label="Menções por dia e sentimento" onMouseLeave={() => setHover(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = PAD.left + i * band + band / 2;
          let acc = 0;
          const segs = SERIES.map((s) => {
            const v = d[s.key];
            const y0 = y(acc);
            acc += v;
            return { ...s, v, y0, y1: y(acc) };
          }).filter((s) => s.v > 0);
          return (
            <g key={d.date} opacity={hover == null || hover === i ? 1 : 0.45}>
              {segs.map((s, k) => {
                const top = k === segs.length - 1;
                // 2px surface gap between stacked segments
                const hgt = Math.max(1, s.y0 - s.y1 - (k > 0 ? 2 : 0));
                return (
                  <rect
                    key={s.key}
                    x={cx - barW / 2}
                    y={s.y1}
                    width={barW}
                    height={hgt}
                    rx={top ? Math.min(4, barW / 2) : 0}
                    fill={s.color}
                  />
                );
              })}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                  {fmtDay(d.date)}
                </text>
              )}
              {/* hit target wider than the mark */}
              <rect
                x={cx - band / 2}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-6 rounded-md border border-line bg-surface-1 px-2 py-1.5 text-xs shadow-sm"
          style={{ left: Math.min(width - 130, Math.max(0, PAD.left + hover * band + band + 4)) }}
        >
          <div className="mb-1 text-ink-3">{fmtDay(h.date)}</div>
          {[...SERIES].reverse().map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
              <span className="text-ink-2">{s.label}</span>
              <span className="ml-auto pl-3 font-medium">{h[s.key]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
