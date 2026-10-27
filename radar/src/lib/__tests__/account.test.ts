import { describe, expect, it } from "vitest";
import { computeAccountHealth, describeMove, marketScore, type AccountInput } from "../health/account";

const base: AccountInput = { reputation: 78, reputationComponents: [], mentions7d: 20, negative7d: 0, rating: null, stock: null, strategy: null };

describe("computeAccountHealth", () => {
  it("good reputation does not hide a closing client", () => {
    const r = computeAccountHealth({ ...base, strategy: { churn: "alto", expansion: "baixo", churnWhy: ["Site vai fechar"], expansionWhy: [] } });
    expect(r.score!).toBeLessThan(45);
    expect(r.motivos[0]).toEqual({ polaridade: "neg", texto: "Risco de cancelamento alto: Site vai fechar" });
  });
  it("renormalises when there is no stock", () => {
    const r = computeAccountHealth({ ...base, strategy: { churn: "baixo", expansion: "medio", churnWhy: [], expansionWhy: [] } });
    expect(r.components.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 1);
    expect(r.score!).toBeGreaterThan(80);
  });
  it("returns null without any data", () => {
    expect(computeAccountHealth({ ...base, reputation: null }).score).toBeNull();
  });
});

describe("market reading", () => {
  it("a drop in line with the index is the market's", () => {
    expect(describeMove(-0.21, -0.156, "Ibovespa").polaridade).toBe("neu");
    expect(describeMove(-0.21, -0.156, "Ibovespa").texto).toContain("queda explicada pelo mercado");
  });
  it("falling less than the index counts as beating the market", () => {
    expect(describeMove(-0.057, -0.156, "Ibovespa").polaridade).toBe("pos");
  });
  it("a drop well beyond the index is the company's", () => {
    expect(describeMove(-0.415, -0.156, "Ibovespa").polaridade).toBe("neg");
  });
  it("market score centres at 70 and falls with underperformance", () => {
    expect(marketScore(0, 0)).toBe(70);
    expect(marketScore(-0.2, -0.2)!).toBeCloseTo(40);
    expect(marketScore(null, null)).toBeNull();
  });
});
