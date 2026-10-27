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
  ticker?: string | null;
  market?: string | null;
  segment?: string | null;
  sources: { type: SourceType; name: string; intervalMinutes: number; config: Prisma.InputJsonValue }[];
}

// Initial strategic readings (prisma/leituras.json), written from research on the date below, so the
// dashboard has a reading before the first Claude run. Clients flagged sem_dados are skipped.
const READINGS_DATE = new Date("2026-10-27T12:00:00Z");

async function loadReadings() {
  const file = path.join(import.meta.dirname, "leituras.json");
  const readings: Record<string, Record<string, unknown>> = JSON.parse(readFileSync(file, "utf8"));
  let n = 0;
  for (const [name, data] of Object.entries(readings)) {
    if (data.sem_dados) continue;
    const client = await prisma.client.findFirst({ where: { name }, include: { reports: { take: 1 } } });
    if (!client || client.reports.length > 0) continue;
    await prisma.strategicReport.create({
      data: { clientId: client.id, createdAt: READINGS_DATE, model: "leitura inicial (pesquisa de 27/10/2026)", data: data as object },
    });
    n++;
  }
  if (n) console.log(`${n} leitura(s) estratégica(s) inicial(is) carregadas`);
}

// Loads the agency's client list from prisma/clientes.json.
// Default: only when the database has no clients (first run). --force adds any missing by name.
async function main() {
  const force = process.argv.includes("--force");
  const list: SeedClient[] = JSON.parse(readFileSync(path.join(import.meta.dirname, "clientes.json"), "utf8"));
  if (process.argv.includes("--update-meta")) {
    for (const c of list) {
      await prisma.client.updateMany({
        where: { name: c.name },
        data: { ticker: c.ticker ?? null, market: c.market ?? null, segment: c.segment ?? null, description: c.description },
      });
    }
    console.log("Ticker, mercado e segmento atualizados a partir de clientes.json");
    await loadReadings();
    return;
  }
  const existing = await prisma.client.findMany({ select: { name: true } });
  if (existing.length > 0 && !force) {
    console.log(`Banco já tem ${existing.length} cliente(s); nada a carregar (use --force para adicionar os que faltam).`);
    return;
  }
  const names = new Set(existing.map((c) => c.name));
  let created = 0;
  for (const c of list) {
    if (names.has(c.name)) continue;
    await prisma.client.create({
      data: {
        name: c.name,
        description: c.description,
        keywords: c.keywords,
        excludeTerms: c.excludeTerms ?? [],
        ticker: c.ticker ?? null,
        market: c.market ?? null,
        segment: c.segment ?? null,
        sources: { create: c.sources },
      },
    });
    created++;
  }
  console.log(`${created} cliente(s) carregados de clientes.json`);
  await loadReadings();
}

main().finally(() => prisma.$disconnect());
