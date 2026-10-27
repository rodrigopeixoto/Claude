import { describe, expect, it } from "vitest";
import { containsAny, normalize, stripHtml, stripPublisherSuffix } from "../text";

describe("text", () => {
  it("normalizes accents and punctuation", () => {
    expect(normalize("Reclamação: NÃO funciona!")).toBe("reclamacao nao funciona");
  });
  it("matches whole terms only", () => {
    expect(containsAny("Vaga aberta no Nubank", ["vaga"])).toBe(true);
    expect(containsAny("Divagando sobre bancos", ["vaga"])).toBe(false);
    expect(containsAny("Nu Holdings sobe", ["Nu Holdings"])).toBe(true);
  });
  it("strips html and entities", () => {
    expect(stripHtml('<a href="x">Nubank &amp; Itaú</a>&nbsp;hoje')).toBe("Nubank & Itaú hoje");
  });
  it("drops publisher suffix from headlines", () => {
    expect(stripPublisherSuffix("Nubank lança cartão - Estadão")).toBe("Nubank lança cartão");
  });
});
