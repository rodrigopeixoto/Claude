import { existsSync, readFileSync } from "node:fs";

/** Loads ./.env into process.env without overriding variables that are already set. */
export function loadEnv(file = ".env") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || m[1] in process.env) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (value !== "") process.env[m[1]] = value;
  }
}
