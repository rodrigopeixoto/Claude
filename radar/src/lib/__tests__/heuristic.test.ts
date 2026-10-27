import { describe, expect, it } from "vitest";
import { analyzeHeuristic } from "../analysis/heuristic";

const base = { id: "1", title: null, rating: null } as const;

describe("analyzeHeuristic", () => {
  it("uses store rating as main signal", () => {
    const a = analyzeHeuristic({ ...base, channel: "PLAY_STORE", content: "app", rating: 1 });
    expect(a.sentimentLabel).toBe("NEGATIVE");
    expect(a.isComplaint).toBe(true);
  });
  it("flags critical terms", () => {
    const a = analyzeHeuristic({ ...base, channel: "NEWS", content: "Clientes denunciam golpe e vazamento de dados" });
    expect(a.severity).toBe(3);
    expect(a.topic).toBe("fraude_seguranca");
  });
  it("positive praise", () => {
    const a = analyzeHeuristic({ ...base, channel: "APP_STORE", content: "Excelente, recomendo", rating: 5 });
    expect(a.sentimentLabel).toBe("POSITIVE");
    expect(a.severity).toBe(0);
  });
  it("Reclame Aqui is always a complaint", () => {
    expect(analyzeHeuristic({ ...base, channel: "RECLAME_AQUI", content: "Aguardando retorno" }).isComplaint).toBe(true);
  });
});
