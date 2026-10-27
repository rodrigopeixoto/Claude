import { CollectorConfigError, cfg, fetchJson, keywordQuery, type Collector } from "./types";

type Config = { query: string; channelId: string; regionCode: string; relevanceLanguage: string };

interface SearchResponse {
  items: { id: { videoId: string }; snippet: { title: string; description: string; channelTitle: string; publishedAt: string } }[];
}
interface VideosResponse {
  items: { id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
}

/**
 * YouTube Data API v3. Search costs 100 quota units (default daily quota: 10 000),
 * so keep the interval ≥ 6h per source.
 */
export const youtube: Collector = async ({ source, client, since }) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new CollectorConfigError("YOUTUBE_API_KEY não configurada");
  const c = cfg<Config>(source);
  const params = new URLSearchParams({
    key,
    part: "snippet",
    type: "video",
    order: "date",
    maxResults: "25",
    publishedAfter: since.toISOString(),
    regionCode: c.regionCode ?? "BR",
    relevanceLanguage: c.relevanceLanguage ?? "pt",
  });
  if (c.channelId) params.set("channelId", c.channelId);
  if (c.query || !c.channelId) params.set("q", c.query || keywordQuery(client).replaceAll(" OR ", "|"));
  const search = await fetchJson<SearchResponse>(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (search.items.length === 0) return [];

  const ids = search.items.map((i) => i.id.videoId).join(",");
  const stats = await fetchJson<VideosResponse>(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${key}`,
  );
  const byId = new Map(stats.items.map((v) => [v.id, v.statistics]));

  return search.items.map((i) => {
    const s = byId.get(i.id.videoId);
    return {
      channel: "YOUTUBE" as const,
      externalId: i.id.videoId,
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
      title: i.snippet.title,
      content: `${i.snippet.title}. ${i.snippet.description}`,
      author: i.snippet.channelTitle,
      publishedAt: new Date(i.snippet.publishedAt),
      engagement: s ? Number(s.likeCount ?? 0) + Number(s.commentCount ?? 0) : undefined,
      raw: s ? { views: Number(s.viewCount ?? 0) } : undefined,
    };
  });
};
