import Link from "next/link";
import { Delta, ScoreNumber, StatusChip } from "@/components/ScoreBadge";
import { Change, Motivos, Stars } from "@/components/Signals";
import { Sparkline } from "@/components/Sparkline";
import { getOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof getOverview>>[number];

const LEVEL: Record<string, number> = { baixo: 1, medio: 2, alto: 3 };
const LEVEL_LABEL: Record<string, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

const SORTS: Record<string, { label: string; value: (c: Row) => number | string | null; desc?: boolean }> = {
  nome: { label: "Cliente", value: (c) => c.name.toLowerCase() },
  conta: { label: "Saúde da conta", value: (c) => c.account.score, desc: true },
  score: { label: "Reputação", value: (c) => c.latest?.score ?? null, desc: true },
  variacao: { label: "Δ 7d", value: (c) => c.delta },
  mencoes: { label: "Menções 7d", value: (c) => c.latest?.mentions7d ?? 0, desc: true },
  negativas: { label: "Negativas 7d", value: (c) => c.latest?.negative7d ?? 0, desc: true },
  pctneg: { label: "% neg.", value: (c) => (c.latest?.mentions7d ? c.latest.negative7d / c.latest.mentions7d : null), desc: true },
  reclamacoes: { label: "Reclamações 7d", value: (c) => c.latest?.complaints7d ?? 0, desc: true },
  nota: { label: "Nota lojas 30d", value: (c) => c.ratings.avg },
  acao30: { label: "Ação 30d", value: (c) => c.stock30 },
  churn: { label: "Risco canc.", value: (c) => (c.churn ? LEVEL[c.churn] : null), desc: true },
  expansao: { label: "Expansão", value: (c) => (c.expansion ? LEVEL[c.expansion] : null), desc: true },
  alertas: { label: "Alertas", value: (c) => c.openAlerts, desc: true },
};

function sortRows(rows: Row[], key: string) {
  const s = SORTS[key] ?? SORTS.conta;
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
  const ordem = sp.ordem && sp.ordem in SORTS ? sp.ordem : "conta";
  // Risk and expansion come from the strategic reading (needs ANTHROPIC_API_KEY).
  const cards = sp.visao === "cartoes";
  const sorted = sortRows(clients, ordem);
  const withData = clients.filter((c) => c.account.score != null);
  const missing = clients.filter((c) => c.account.score == null).sort((a, b) => a.name.localeCompare(b.name));
  const avg = withData.length ? withData.reduce((a, c) => a + c.account.score!, 0) / withData.length : null;
  const atRisk = withData.filter((c) => c.account.score! < 60).length;
  const rated = clients.filter((c) => c.ratings.count > 0);
  const ratingCount = rated.reduce((a, c) => a + c.ratings.count, 0);
  const ratingAvg = ratingCount ? rated.reduce((a, c) => a + c.ratings.avg! * c.ratings.count, 0) / ratingCount : null;
  const totalMentions = clients.reduce((a, c) => a + (c.latest?.mentions7d ?? 0), 0);
  const totalNeg = clients.reduce((a, c) => a + (c.latest?.negative7d ?? 0), 0);
  const openAlerts = clients.reduce((a, c) => a + c.openAlerts, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-ink-2">Saúde de cada conta: reputação (7 dias), bolsa comparada ao índice e leitura estratégica.</p>
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
        <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Clientes monitorados", `${clients.length}`, `${withData.length} com dados${missing.length ? `. Faltam: ${missing.map((c) => `${c.name} (${c.sourceCount === 0 ? "sem fontes: confirmar a empresa" : "sem menções em 7 dias"})`).join(", ")}` : ""}`],
            ["Saúde média das contas", avg == null ? "—" : fmt1(avg), "reputação, bolsa e leitura estratégica"],
            ["Em atenção ou pior", `${atRisk}`, "saúde da conta abaixo de 60"],
            ["Nota média nas lojas (30 dias)", ratingAvg == null ? "—" : `${fmt1(ratingAvg)} ★`, `${ratingCount.toLocaleString("pt-BR")} avaliações de ${rated.length} clientes`],
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
                <StatusChip score={c.account.score} />
              </div>
              <div className="mt-4 flex items-end justify-between gap-2">
                <div>
                  <ScoreNumber score={c.account.score} />
                  <div><Delta value={c.delta} /></div>
                </div>
                <Sparkline points={c.trend.map((t) => t.score)} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-xs">
                <div><dt className="text-ink-3">Menções 7d</dt><dd className="text-base font-medium">{c.latest?.mentions7d ?? 0}</dd></div>
                <div><dt className="text-ink-3">Negativas</dt><dd className="text-base font-medium">{c.latest?.negative7d ?? 0}</dd></div>
                <div><dt className="text-ink-3">Nota lojas</dt><dd className="text-base font-medium"><Stars avg={c.ratings.avg} count={c.ratings.count} /></dd></div>
              </dl>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[88rem] text-sm">
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
                const a = c.account;
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
                        <span className="w-10 font-medium">{a.score == null ? "—" : fmt1(a.score)}</span>
                        <StatusChip score={a.score} />
                      </div>
                      <div className="mt-1 max-w-sm text-left"><Motivos items={a.motivos} /></div>
                    </td>
                    <td className="px-3 py-2 text-right" title={`${c.explain.faixa}. ${c.explain.motivo}`}>{l?.score == null ? "—" : fmt1(l.score)}</td>
                    <td className="px-3 py-2 text-right"><Change value={c.delta} unit="pts" /></td>
                    <td className="px-3 py-2 text-right">{l?.mentions7d ?? 0}</td>
                    <td className="px-3 py-2 text-right">{l?.negative7d ?? 0}</td>
                    <td className="px-3 py-2 text-right">{pct == null ? "—" : `${Math.round(pct * 100)}%`}</td>
                    <td className="px-3 py-2 text-right">{l?.complaints7d ?? 0}</td>
                    <td className="px-3 py-2 text-right"><Stars avg={c.ratings.avg} count={c.ratings.count} /></td>
                    <td className="px-3 py-2 text-right"><Change value={c.stock30} /></td>
                    <td className="px-3 py-2 text-right">{c.churn ? LEVEL_LABEL[c.churn] : "—"}</td>
                    <td className="px-3 py-2 text-right">{c.expansion ? LEVEL_LABEL[c.expansion] : "—"}</td>
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
