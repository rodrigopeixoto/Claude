import { loadEnv } from "@/lib/loadEnv";
import { analyzePending } from "@/lib/analysis/analyze";
import { prisma } from "@/lib/db";
import { refreshHealth, snapshotClient } from "@/lib/health/compute";
import { runSource } from "@/lib/pipeline/runSource";
import { cycle } from "./cycle";

loadEnv();

// npm run collect                 → one full cycle (only due sources)
// npm run collect -- --all        → run every enabled source now
// npm run collect -- --source ID  → run one source
// npm run collect -- --backfill 30 → recompute daily snapshots for the last N days (after importing history)
async function main() {
  const args = process.argv.slice(2);
  const backfillIdx = args.indexOf("--backfill");
  if (backfillIdx >= 0) {
    const days = Number(args[backfillIdx + 1] ?? 30);
    const clients = await prisma.client.findMany({ select: { id: true, name: true } });
    for (const c of clients) {
      for (let d = days; d >= 0; d--) await snapshotClient(c.id, new Date(Date.now() - d * 24 * 3600_000));
      console.log(`${c.name}: ${days + 1} snapshots`);
    }
    await prisma.$disconnect();
    return;
  }
  const sourceIdx = args.indexOf("--source");
  if (sourceIdx >= 0 || args.includes("--all")) {
    const ids =
      sourceIdx >= 0
        ? [args[sourceIdx + 1]]
        : (await prisma.source.findMany({ where: { enabled: true }, select: { id: true } })).map((s) => s.id);
    for (const id of ids) {
      const r = await runSource(id);
      console.log(r.ok ? `${r.label}: ${r.found} encontrados, ${r.inserted} novos` : `${r.label}: ERRO ${r.error}`);
    }
    const touched = await analyzePending(5000);
    await refreshHealth(touched);
    console.log(`analisados: ${touched.size} cliente(s)`);
  } else {
    await cycle();
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
