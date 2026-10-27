import { loadEnv } from "@/lib/loadEnv";
import { prisma } from "@/lib/db";
import { refreshHealth } from "@/lib/health/compute";
import { refreshAllTickers } from "@/lib/stocks";
import { generateStrategy } from "@/lib/strategy";
import { cycle } from "./cycle";

loadEnv();

const TICK_MS = Number(process.env.WORKER_TICK_SECONDS ?? 60) * 1000;
const HEALTH_EVERY_MS = 60 * 60_000;
const STOCKS_EVERY_MS = 6 * 60 * 60_000;
const STRATEGY_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

let lastFullHealth = 0;
let lastStocks = 0;

/** Weekly strategic reading per client, two per tick so cost and rate limits stay spread out. */
async function refreshStrategies() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.STRATEGY_AUTO === "off") return;
  const clients = await prisma.client.findMany({
    where: { sources: { some: {} } },
    select: { id: true, name: true, reports: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
  });
  const due = clients.filter((c) => !c.reports[0] || Date.now() - c.reports[0].createdAt.getTime() > STRATEGY_MAX_AGE_MS).slice(0, 2);
  for (const c of due) {
    try {
      await generateStrategy(c.id);
      console.log(`[estratégia] ${c.name}: leitura gerada`);
    } catch (err) {
      console.error(`[estratégia] ${c.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
let stopping = false;

async function main() {
  console.log(`[worker] iniciado, tick ${TICK_MS / 1000}s`);
  while (!stopping) {
    const started = Date.now();
    try {
      if (started - lastStocks >= STOCKS_EVERY_MS) {
        await refreshAllTickers();
        lastStocks = started;
      }
      await cycle();
      // Daily snapshots must exist even for clients without new mentions.
      if (started - lastFullHealth >= HEALTH_EVERY_MS) {
        await refreshHealth();
        lastFullHealth = started;
      }
      await refreshStrategies();
    } catch (err) {
      console.error("[worker] ciclo falhou", err);
    }
    const wait = Math.max(1000, TICK_MS - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig}, encerrando após o ciclo atual`);
    stopping = true;
    setTimeout(() => process.exit(0), 30_000).unref();
  });
}

main();
