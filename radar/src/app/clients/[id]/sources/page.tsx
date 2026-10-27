import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceForm } from "@/components/SourceForm";
import { SourceRow } from "@/components/SourceRow";
import { prisma } from "@/lib/db";
import { missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ClientSources({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, include: { sources: { orderBy: { createdAt: "asc" } } } });
  if (!client) notFound();
  const missing = missingEnv();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/clients/${id}`} className="text-sm text-ink-2 hover:text-ink">← {client.name}</Link>
        <h1 className="text-2xl font-semibold">Fontes de informação</h1>
        <p className="text-sm text-ink-2">O worker coleta cada fonte ativa no intervalo definido. &quot;Coletar agora&quot; roda na hora e já classifica.</p>
      </div>
      {missing.includes("ANTHROPIC_API_KEY") && (
        <p className="card p-3 text-sm text-ink-2">
          ℹ ANTHROPIC_API_KEY não configurada: o sentimento está sendo calculado por heurística local (menos precisa). Configure a chave para classificação por IA.
        </p>
      )}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-medium text-ink-2">Fontes ({client.sources.length})</h2>
        <ul>
          {client.sources.map((s) => <SourceRow key={s.id} source={s} missingEnv={missing} />)}
          {client.sources.length === 0 && <li className="py-4 text-sm text-ink-3">Nenhuma fonte ainda.</li>}
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-ink-2">Adicionar fonte</h2>
        <SourceForm clientId={id} missingEnv={missing} />
      </section>
    </div>
  );
}
