import { describe, expect, it } from "vitest";
import { computeHealth, scoreBand, type MentionStat } from "../health/score";

const m = (sentiment: number, extra: Partial<MentionStat> = {}): MentionStat => ({
  sentiment,
  engagement: null,
  isComplaint: false,
  severity: 0,
  ...extra,
});

describe("computeHealth", () => {
  it("returns null without data", () => {
    expect(computeHealth({ recent: [], baselineNegativePerWeek: null, ratings30d: [] }).score).toBeNull();
  });
  it("all positive, no risk → high score", () => {
    const r = computeHealth({ recent: [m(1), m(0.8), m(0.9)], baselineNegativePerWeek: null, ratings30d: [5, 5, 4] });
    expect(r.score).toBeGreaterThan(85);
  });
  it("negative wave scores low and detects spike", () => {
    const recent = Array.from({ length: 12 }, () => m(-0.8, { isComplaint: true, severity: 2 }));
    const r = computeHealth({ recent, baselineNegativePerWeek: 2, ratings30d: [1, 2, 1] });
    expect(r.score).toBeLessThan(30);
    expect(r.spikeRatio).toBe(6);
    expect(scoreBand(r.score).status).toBe("critical");
  });
  it("renormalizes weights when components are missing", () => {
    const r = computeHealth({ recent: [m(0), m(0), m(0)], baselineNegativePerWeek: null, ratings30d: [] });
    const total = r.components.reduce((a, c) => a + c.weight, 0);
    expect(total).toBeCloseTo(1, 1);
  });
  it("one critical item hurts a small brand more than a big one", () => {
    const small = computeHealth({ recent: [m(0, { severity: 3 }), m(0), m(0)], baselineNegativePerWeek: null, ratings30d: [] });
    const bigRecent = [m(0, { severity: 3 }), ...Array.from({ length: 300 }, () => m(0))];
    const big = computeHealth({ recent: bigRecent, baselineNegativePerWeek: null, ratings30d: [] });
    const risk = (r: typeof small) => r.components.find((c) => c.key === "risk")!.score;
    expect(risk(small)).toBeLessThan(risk(big));
  });
});
