import { describe, expect, it } from "vitest";
import { mapApifyItem } from "../collectors/apify";
import { parseSeenDate } from "../collectors/gdelt";
import { parseFeed } from "../collectors/rssParse";
import { filterItems, mentionHash } from "../pipeline/runSource";

describe("parseFeed", () => {
  it("parses Google News style RSS", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Nubank lança X - Valor</title><link>https://n.com/a</link><guid>g1</guid>
      <pubDate>Mon, 27 Oct 2026 10:00:00 GMT</pubDate><description>&lt;a&gt;Nubank lança X&lt;/a&gt;</description><source url="https://valor.com">Valor</source></item>
    </channel></rss>`;
    const [e] = parseFeed(xml);
    expect(e.title).toBe("Nubank lança X - Valor");
    expect(e.sourceName).toBe("Valor");
    expect(e.publishedAt.toISOString()).toBe("2026-10-27T10:00:00.000Z");
  });
  it("parses Atom", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>e1</id><title>Olá</title><link href="https://b.com/1"/><updated>2026-10-01T00:00:00Z</updated><summary>Resumo</summary></entry></feed>`;
    const [e] = parseFeed(xml);
    expect(e.link).toBe("https://b.com/1");
    expect(e.description).toBe("Resumo");
  });
});

describe("gdelt", () => {
  it("parses seendate", () => {
    expect(parseSeenDate("20261027T143000Z").toISOString()).toBe("2026-10-27T14:30:00.000Z");
  });
});

describe("mapApifyItem", () => {
  it("maps common LinkedIn-like fields", () => {
    const item = mapApifyItem(
      { urn: "u1", text: "Parabéns <b>Acme</b>!", url: "https://li/p/1", authorName: "Ana", postedAtISO: "2026-10-20T10:00:00Z", numLikes: 10, numComments: 2 },
      "LINKEDIN",
    )!;
    expect(item.externalId).toBe("u1");
    expect(item.content).toBe("Parabéns Acme !");
    expect(item.author).toBe("Ana");
    expect(item.engagement).toBe(12);
  });
  it("respects explicit fieldMap and unix timestamps", () => {
    const item = mapApifyItem({ data: { body: "Reclamação X", ts: 1_760_000_000 } }, "RECLAME_AQUI", {
      content: "data.body",
      date: "data.ts",
    })!;
    expect(item.content).toBe("Reclamação X");
    expect(item.publishedAt.getTime()).toBe(1_760_000_000_000);
  });
  it("skips items without text", () => {
    expect(mapApifyItem({ id: 1 }, "INSTAGRAM")).toBeNull();
  });
});

describe("pipeline helpers", () => {
  const now = new Date();
  it("dedupes syndicated news by headline", () => {
    const a = { channel: "NEWS" as const, externalId: "1", title: "Nubank sobe - Valor", content: "x", publishedAt: now };
    const b = { ...a, externalId: "2", title: "Nubank sobe – InfoMoney" };
    expect(mentionHash(a)).toBe(mentionHash(b));
  });
  it("filters exclude terms and old items", () => {
    const items = [
      { channel: "NEWS" as const, externalId: "1", content: "Vaga no Nubank", publishedAt: now },
      { channel: "NEWS" as const, externalId: "2", content: "Nubank cresce", publishedAt: now },
      { channel: "NEWS" as const, externalId: "3", content: "Nubank antigo", publishedAt: new Date(0) },
    ];
    const out = filterItems(items, { excludeTerms: ["vaga"] }, new Date(Date.now() - 1000));
    expect(out.map((i) => i.externalId)).toEqual(["2"]);
  });
});
