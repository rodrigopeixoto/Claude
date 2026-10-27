import { loadEnv } from "@/lib/loadEnv";
import { refreshHealth } from "@/lib/health/compute";
import { cycle } from "./cycle";

loadEnv();

const TICK_MS = Number(process.env.WORKER_TICK_SECONDS ?? 60) * 1000;
const HEALTH_EVERY_MS = 60 * 60_000;

let lastFullHealth = 0;
let stopping = false;

async function main() {
  console.log(`[worker] iniciado, tick ${TICK_MS / 1000}s`);
  while (!stopping) {
    const started = Date.now();
    try {
      await cycle();
      // Daily snapshots must exist even for clients without new mentions.
      if (started - lastFullHealth >= HEALTH_EVERY_MS) {
        await refreshHealth();
        lastFullHealth = started;
      }
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
