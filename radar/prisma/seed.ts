import { readFileSync } from "node:fs";
import path from "node:path";
import type { Prisma, SourceType } from "@prisma/client";
import { loadEnv } from "@/lib/loadEnv";
import { prisma } from "@/lib/db";

loadEnv();

interface SeedClient {
  name: string;
  description?: string;
  keywords: string[];
  excludeTerms?: string[];
  sources: { type: SourceType; name: string; intervalMinutes: number; config: Prisma.InputJsonValue }[];
}

// Loads the agency's client list from prisma/clientes.json.
// Default: only when the database has no clients (first run). --force adds any missing by name.
async function main() {
  const force = process.argv.includes("--force");
  const existing = await prisma.client.findMany({ select: { name: true } });
  if (existing.length > 0 && !force) {
    console.log(`Banco já tem ${existing.length} cliente(s); nada a carregar (use --force para adicionar os que faltam).`);
    return;
  }
  const names = new Set(existing.map((c) => c.name));
  const list: SeedClient[] = JSON.parse(readFileSync(path.join(import.meta.dirname, "clientes.json"), "utf8"));
  let created = 0;
  for (const c of list) {
    if (names.has(c.name)) continue;
    await prisma.client.create({
      data: {
        name: c.name,
        description: c.description,
        keywords: c.keywords,
        excludeTerms: c.excludeTerms ?? [],
        sources: { create: c.sources },
      },
    });
    created++;
  }
  console.log(`${created} cliente(s) carregados de clientes.json`);
}

main().finally(() => prisma.$disconnect());
