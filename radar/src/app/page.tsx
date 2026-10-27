import Link from "next/link";
import { Delta, ScoreNumber, StatusChip } from "@/components/ScoreBadge";
import { Sparkline } from "@/components/Sparkline";
import { getOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof getOverview>>[number];

const SORTS: Record<string, { label: string; value: (c: Row) => number | string | null; desc?: boolean }> = {
  nome: { label: "Cliente", value: (c) => c.name.toLowerCase() },
  score: { label: "Saúde", value: (c) => c.latest?.score ?? null },
  variacao: { label: "Δ 7d", value: (c) => c.delta },
  mencoes: { label: "Menções 7d", value: (c) => c.latest?.mentions7d ?? 0, desc: true },
  negativas: { label: "Negativas 7d", value: (c) => c.latest?.negative7d ?? 0, desc: true },
  pctneg: { label: "% neg.", value: (c) => (c.latest?.mentions7d ? c.latest.negative7d / c.latest.mentions7d : null), desc: true },
  reclamacoes: { label: "Reclamações 7d", value: (c) => c.latest?.complaints7d ?? 0, desc: true },
  nota: { label: "Nota apps", value: (c) => c.latest?.avgRating30d ?? null },
  alertas: { label: "Alertas", value: (c) => c.openAlerts, desc: true },
};

function sortRows(rows: Row[], key: string) {
  const s = SORTS[key] ?? SORTS.score;
  return [...rows].sort((a, b) => {
    const va = s.value(a);
    const vb = s.value(b);
    if (va == null && vb == null) return a.name.localeCompare(b.name);
    if (va == null) return 1; // no data always last
    if (vb == null) return -1;
    const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
    return s.desc ? -cmp : cmp;
  });
}

const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export default async function Home({ searchParams }: { searchParams: Promise<{ ordem?: string; visao?: string }> }) {
  const sp = await searchParams;
  const clients = await getOverview();
  const ordem = sp.ordem && sp.ordem in SORTS ? sp.ordem : "score";
  const cards = sp.visao === "cartoes";
  const sorted = sortRows(clients, ordem);
  const withData = clients.filter((c) => c.latest?.score != null);
  const avg = withData.length ? withData.reduce((a, c) => a + c.latest!.score!, 0) / withData.length : null;
  const atRisk = withData.filter((c) => c.latest!.score! < 60).length;
  const totalMentions = clients.reduce((a, c) => a + (c.latest?.mentions7d ?? 0), 0);
  const totalNeg = clients.reduce((a, c) => a + (c.latest?.negative7d ?? 0), 0);
  const openAlerts = clients.reduce((a, c) => a + c.openAlerts, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-ink-2">Comparativo de saúde de reputação, janela de 7 dias.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
            <Link href={`/?ordem=${ordem}`} className={`px-3 py-1.5 ${cards ? "text-ink-2" : "bg-surface-2 font-medium"}`}>Tabela</Link>
            <Link href={`/?ordem=${ordem}&visao=cartoes`} className={`px-3 py-1.5 ${cards ? "bg-surface-2 font-medium" : "text-ink-2"}`}>Cartões</Link>
          </div>
          <Link href="/clients/new" className="btn btn-primary">+ Novo cliente</Link>
        </div>
      </div>

      {clients.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Clientes monitorados", `${clients.length}`, `${withData.length} com dados`],
            ["Saúde média", avg == null ? "—" : fmt1(avg), "entre os clientes com dados"],
            ["Em atenção ou pior", `${atRisk}`, "score abaixo de 60"],
            ["Menções 7d", totalMentions.toLocaleString("pt-BR"), `${totalNeg.toLocaleString("pt-BR")} negativas`],
            ["Alertas abertos", `${openAlerts}`, "todas as contas"],
          ].map(([label, value, sub]) => (
            <div key={label} className="card p-4">
              <dt className="text-xs text-ink-3">{label}</dt>
              <dd className="mt-1 text-3xl font-semibold tracking-tight">{value}</dd>
              <dd className="text-xs text-ink-3">{sub}</dd>
            </div>
          ))}
        </dl>
      )}

      {clients.length === 0 ? (
        <div className="card p-10 text-center text-ink-2">
          Nenhum cliente ainda. <Link href="/clients/new" className="text-accent underline">Cadastre o primeiro</Link>.
        </div>
      ) : cards ? (
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
                  <div><Delta value={c.delta} /></div>
                </div>
                <Sparkline points={c.trend.map((t) => t.score)} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-xs">
                <div><dt className="text-ink-3">Menções 7d</dt><dd className="text-base font-medium">{c.latest?.mentions7d ?? 0}</dd></div>
                <div><dt className="text-ink-3">Negativas</dt><dd className="text-base font-medium">{c.latest?.negative7d ?? 0}</dd></div>
                <div><dt className="text-ink-3">Nota apps</dt><dd className="text-base font-medium">{c.latest?.avgRating30d ? `${c.latest.avgRating30d.toFixed(1)}★` : "—"}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                {Object.entries(SORTS).map(([key, s]) => (
                  <th key={key} className={`px-3 py-2.5 font-normal ${key === "nome" ? "" : "text-right"}`} aria-sort={ordem === key ? (s.desc ? "descending" : "ascending") : undefined}>
                    <Link href={`/?ordem=${key}`} className={`hover:text-ink ${ordem === key ? "font-medium text-ink" : ""}`}>
                      {s.label}{ordem === key ? (s.desc ? " ↓" : " ↑") : ""}
                    </Link>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-normal">30 dias</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const l = c.latest;
                const pct = l?.mentions7d ? l.negative7d / l.mentions7d : null;
                return (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-2">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      {c.sourceCount === 0 ? (
                        <div className="text-xs text-ink-3">sem fontes · configurar</div>
                      ) : c.failingSources > 0 ? (
                        <div className="text-xs text-ink-3">⨯ {c.failingSources} fonte(s) com erro</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-20 rounded-full bg-surface-2 md:block" aria-hidden>
                          {l?.score != null && <div className="h-1.5 rounded-full" style={{ width: `${l.score}%`, background: "var(--seq)" }} />}
                        </div>
                        <span className="w-10 font-medium">{l?.score == null ? "—" : fmt1(l.score)}</span>
                        <StatusChip score={l?.score ?? null} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-2">{c.delta == null ? "—" : `${c.delta > 0 ? "+" : ""}${fmt1(c.delta)}`}</td>
                    <td className="px-3 py-2 text-right">{l?.mentions7d ?? 0}</td>
                    <td className="px-3 py-2 text-right">{l?.negative7d ?? 0}</td>
                    <td className="px-3 py-2 text-right">{pct == null ? "—" : `${Math.round(pct * 100)}%`}</td>
                    <td className="px-3 py-2 text-right">{l?.complaints7d ?? 0}</td>
                    <td className="px-3 py-2 text-right">{l?.avgRating30d ? `${l.avgRating30d.toFixed(1)}★` : "—"}</td>
                    <td className="px-3 py-2 text-right">{c.openAlerts || ""}</td>
                    <td className="px-3 py-2"><div className="flex justify-end"><Sparkline points={c.trend.map((t) => t.score)} width={90} height={24} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
