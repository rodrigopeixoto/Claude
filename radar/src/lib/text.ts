import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase, strip accents and punctuation — used for matching and dedupe. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function containsAny(text: string, terms: string[]): boolean {
  const haystack = ` ${normalize(text)} `;
  return terms.some((t) => {
    const needle = normalize(t);
    return needle.length > 0 && haystack.includes(` ${needle} `);
  });
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1)}…`;
}

/** Google News appends " - Veículo" to titles; drop it so syndicated copies dedupe. */
export function stripPublisherSuffix(title: string): string {
  return title.replace(/\s+[-–|]\s+[^-–|]{2,60}$/, "").trim();
}
