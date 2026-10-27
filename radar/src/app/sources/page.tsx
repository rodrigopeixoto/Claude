import { SourceRow } from "@/components/SourceRow";
import { prisma } from "@/lib/db";
import { missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AllSources() {
  const sources = await prisma.source.findMany({
    include: { client: { select: { name: true } } },
    orderBy: [{ lastStatus: "asc" }, { client: { name: "asc" } }],
  });
  const missing = missingEnv();
  const failing = sources.filter((s) => s.enabled && s.lastStatus === "ERROR").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Todas as fontes</h1>
        <p className="text-sm text-ink-2">
          {sources.length} fontes · {sources.filter((s) => s.enabled).length} ativas · {failing} com erro
        </p>
      </div>
      <section className="card p-5">
        <ul>
          {sources.map((s) => <SourceRow key={s.id} source={s} clientName={s.client.name} missingEnv={missing} />)}
          {sources.length === 0 && <li className="py-4 text-sm text-ink-3">Nenhuma fonte cadastrada.</li>}
        </ul>
      </section>
    </div>
  );
}
