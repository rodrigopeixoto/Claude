import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["google-play-scraper"],
  // radar/ lives inside another repo with its own lockfile; pin the tracing root here.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
};

export default nextConfig;
