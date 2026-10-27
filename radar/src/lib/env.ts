/** Optional integrations whose keys are absent — shown as warnings in the sources UI. */
export function missingEnv(): string[] {
  return ["YOUTUBE_API_KEY", "APIFY_TOKEN", "ANTHROPIC_API_KEY"].filter((k) => !process.env[k]);
}
