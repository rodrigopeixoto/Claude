import Link from "next/link";
import { Delta, ScoreNumber, StatusChip } from "@/components/ScoreBadge";
import { Sparkline } from "@/components/Sparkline";
import { getOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const clients = await getOverview();
  const sorted = [...clients].sort((a, b) => (a.latest?.score ?? 101) - (b.latest?.score ?? 101));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-ink-2">Saúde de reputação nos últimos 7 dias, pior primeiro.</p>
        </div>
        <Link href="/clients/new" className="btn btn-primary">
          + Novo cliente
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="card p-10 text-center text-ink-2">
          Nenhum cliente ainda. <Link href="/clients/new" className="text-accent underline">Cadastre o primeiro</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="card block p-5 transition hover:border-ink-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{c.name}</h2>
                  {c.description && <p className="truncate text-xs text-ink-3">{c.description}</p>}
                </div>
                <StatusChip score={c.latest?.score ?? null} />
              </div>
              <div className="mt-4 flex items-end justify-between gap-2">
                <div>
                  <ScoreNumber score={c.latest?.score ?? null} />
                  <div>
                    <Delta value={c.delta} />
                  </div>
                </div>
                <Sparkline points={c.trend.map((t) => t.score)} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-xs">
                <div>
                  <dt className="text-ink-3">Menções 7d</dt>
                  <dd className="text-base font-medium">{c.latest?.mentions7d ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Negativas</dt>
                  <dd className="text-base font-medium">{c.latest?.negative7d ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Nota apps</dt>
                  <dd className="text-base font-medium">{c.latest?.avgRating30d ? `${c.latest.avgRating30d.toFixed(1)}★` : "—"}</dd>
                </div>
              </dl>
              {(c.openAlerts > 0 || c.failingSources > 0 || c.sourceCount === 0) && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-2">
                  {c.openAlerts > 0 && <span>⚠ {c.openAlerts} alerta(s) aberto(s)</span>}
                  {c.failingSources > 0 && <span>⨯ {c.failingSources} fonte(s) com erro</span>}
                  {c.sourceCount === 0 && <span>Nenhuma fonte configurada</span>}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
