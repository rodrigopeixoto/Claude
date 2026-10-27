import { analyzePending } from "@/lib/analysis/analyze";
import { refreshHealth } from "@/lib/health/compute";
import { runDueSources, runSource } from "@/lib/pipeline/runSource";

/** One worker tick: collect due sources → classify new mentions → refresh health of touched clients. */
export async function cycle(log = console.log) {
  const runs = await runDueSources();
  for (const r of runs) {
    log(r.ok ? `[collect] ${r.label}: ${r.found} encontrados, ${r.inserted} novos` : `[collect] ${r.label}: ERRO ${r.error}`);
  }
  const touched = await analyzePending();
  if (touched.size > 0) {
    log(`[analyze] ${touched.size} cliente(s) atualizados`);
    await refreshHealth(touched);
  }
  return { runs, touched };
}

/** Used by the "Coletar agora" button: run one source and process its results right away. */
export async function collectNow(sourceId: string) {
  const result = await runSource(sourceId);
  const touched = await analyzePending();
  if (touched.size > 0) await refreshHealth(touched);
  return result;
}
