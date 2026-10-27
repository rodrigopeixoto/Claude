import { XMLParser } from "fast-xml-parser";
import { stripHtml } from "../text";

export interface FeedEntry {
  id: string;
  title: string;
  link?: string;
  description: string;
  publishedAt: Date;
  sourceName?: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in (value as object)) return String((value as { "#text": unknown })["#text"]);
  return "";
}

function list<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Parses RSS 2.0 and Atom feeds into a flat list. */
export function parseFeed(xml: string): FeedEntry[] {
  const doc = parser.parse(xml);
  if (doc.rss?.channel) {
    return list(doc.rss.channel.item).map((item: Record<string, unknown>) => {
      const link = text(item.link);
      return {
        id: text(item.guid) || link || text(item.title),
        title: stripHtml(text(item.title)),
        link: link || undefined,
        description: stripHtml(text(item.description)),
        publishedAt: new Date(text(item.pubDate) || Date.now()),
        sourceName: text(item.source) || undefined,
      };
    });
  }
  if (doc.feed) {
    return list(doc.feed.entry).map((entry: Record<string, unknown>) => {
      const links = list(entry.link as { "@_href"?: string } | { "@_href"?: string }[]);
      const link = links[0]?.["@_href"];
      return {
        id: text(entry.id) || link || text(entry.title),
        title: stripHtml(text(entry.title)),
        link,
        description: stripHtml(text(entry.summary) || text(entry.content)),
        publishedAt: new Date(text(entry.published) || text(entry.updated) || Date.now()),
      };
    });
  }
  return [];
}
