import { describe, expect, it } from "vitest";
import { benchmarkFor, computeReturns } from "../stocks";

const DAY = 24 * 3600_000;
const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * DAY);

describe("computeReturns", () => {
  it("uses the last close on or before each period start", () => {
    const quotes = Array.from({ length: 400 }, (_, i) => ({ date: day(i), close: 100 + i }));
    const r = computeReturns(quotes)!;
    expect(r[7]).toBeCloseTo(499 / 492 - 1);
    expect(r[365]).toBeCloseTo(499 / 134 - 1);
  });
  it("skips gaps such as weekends", () => {
    const quotes = [{ date: day(0), close: 10 }, { date: day(3), close: 12 }, { date: day(10), close: 15 }];
    expect(computeReturns(quotes)![7]).toBeCloseTo(15 / 12 - 1);
  });
  it("returns null when history is shorter than the period", () => {
    const quotes = [{ date: day(0), close: 10 }, { date: day(20), close: 11 }];
    const r = computeReturns(quotes)!;
    expect(r[30]).toBeNull();
    expect(r[7]).toBeCloseTo(0.1);
  });
});

describe("benchmarkFor", () => {
  it("uses the exchange index for listed tickers, even for Brazil-focused clients", () => {
    expect(benchmarkFor("ENT.L", "BR")?.ticker).toBe("^FTSE");
    expect(benchmarkFor("RDOR3.SA", "BR")?.ticker).toBe("^BVSP");
  });
  it("uses EWZ for a Brazilian business listed in the US", () => {
    expect(benchmarkFor("PICS", "BR")?.ticker).toBe("EWZ");
    expect(benchmarkFor("SGHC", "GB")?.ticker).toBe("^GSPC");
  });
});
