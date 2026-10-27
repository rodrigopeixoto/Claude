import type { Channel, SentimentLabel } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acknowledgeAlert } from "@/app/actions";
import { DailyMentionsChart } from "@/components/charts/DailyMentionsChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { fmtDateTime, MentionItem } from "@/components/MentionItem";
import { Delta, ScoreNumber, StatusChip } from "@/components/ScoreBadge";
import { StockPanel } from "@/components/StockPanel";
import { StrategyPanel } from "@/components/StrategyPanel";
import { SubmitButton } from "@/components/SubmitButton";
import { explainScore } from "@/lib/health/explain";
import { getStock } from "@/lib/stocks";
import { latestStrategy } from "@/lib/strategy";
import { getClientDashboard, PAGE_SIZE } from "@/lib/queries";
import { CHANNEL_LABELS, TOPIC_LABELS } from "@/lib/sourceTemplates";

export const dynamic = "force-dynamic";

type Search = { channel?: string; sentiment?: string; q?: string; page?: string; all?: string; periodo?: string };

const PERIODOS = ["7", "30", "60", "90"];

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getClientDashboard(id, {
    channel: sp.channel && sp.channel in CHANNEL_LABELS ? (sp.channel as Channel) : undefined,
    sentiment: ["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(sp.sentiment ?? "") ? (sp.sentiment as SentimentLabel) : undefined,
    q: sp.q?.trim() || undefined,
    page: Number(sp.page) || 1,
    days: PERIODOS.includes(sp.periodo ?? "") ? Number(sp.periodo) : undefined,
    showIrrelevant: sp.all === "1",
  });
  if (!data) notFound();
  const { client, latest } = data;
  const [stock, strategy] = await Promise.all([client.ticker ? getStock(client.ticker) : null, latestStrategy(client.id)]);
  const explain = explainScore(latest?.score ?? null, data.components);
  const weekAgo = data.trend.length > 7 ? data.trend[data.trend.length - 8] : null;
  const delta = latest?.score != null && weekAgo?.score != null ? latest.score - weekAgo.score : null;
  const maxTopic = Math.max(1, ...data.topics.map((t) => t.n));
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const qs = (patch: Partial<Search>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `?${p}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-ink-2 hover:text-ink">← Clientes</Link>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm text-ink-3">{client.keywords.join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/clients/${id}/sources`} className="btn">
            Fontes ({data.sourceCount}){data.failingSources > 0 ? ` · ${data.failingSources} com erro` : ""}
          </Link>
          <Link href={`/clients/${id}/edit`} className="btn">Editar</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-2">Saúde (7 dias)</h2>
            <StatusChip score={latest?.score ?? null} />
          </div>
          <div className="mt-2">
            <ScoreNumber score={latest?.score ?? null} size="xl" />
            <div><Delta value={delta} /></div>
          </div>
          <p className="mt-2 text-xs text-ink-3">{explain.faixa}. {explain.motivo}</p>
          <ul className="mt-4 space-y-2.5">
            {data.components.map((c) => (
              <li key={c.key} className="text-sm">
                <div className="flex justify-between">
                  <span>{c.label} <span className="text-xs text-ink-3">· peso {Math.round(c.weight * 100)}%</span></span>
                  <span className="font-medium">{Math.round(c.score)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                  <div className="h-1.5 rounded-full" style={{ width: `${c.score}%`, background: "var(--seq)" }} />
                </div>
                <p className="mt-0.5 text-xs text-ink-3">{c.detail}</p>
              </li>
            ))}
            {data.components.length === 0 && <li className="text-sm text-ink-3">Dados insuficientes. Configure fontes e rode a coleta.</li>}
          </ul>
        </section>
        <section className="card min-w-0 p-5 lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-ink-2">Score de saúde — 30 dias</h2>
          <TrendChart points={data.trend} />
        </section>
      </div>

      <StrategyPanel clientId={client.id} report={strategy} />

      <StockPanel stock={stock} />

      <section className="card min-w-0 p-5">
        <h2 className="mb-2 text-sm font-medium text-ink-2">Menções por dia — 30 dias</h2>
        <DailyMentionsChart days={data.daily} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card min-w-0 overflow-x-auto p-5">
          <h2 className="mb-3 text-sm font-medium text-ink-2">Canais — 30 dias</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr>
                <th className="pb-2 font-normal">Canal</th>
                <th className="pb-2 text-right font-normal">Menções</th>
                <th className="pb-2 text-right font-normal">% negativas</th>
                <th className="pb-2 text-right font-normal">Reclamações</th>
                <th className="pb-2 text-right font-normal">Nota</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c) => (
                <tr key={c.channel} className="border-t border-line">
                  <td className="py-2">
                    <Link href={qs({ channel: c.channel, page: undefined })} className="hover:underline">{CHANNEL_LABELS[c.channel]}</Link>
                  </td>
                  <td className="py-2 text-right">{c.n}</td>
                  <td className="py-2 text-right">{Math.round((c.neg / c.n) * 100)}%</td>
                  <td className="py-2 text-right">{c.complaints}</td>
                  <td className="py-2 text-right">{c.avgRating ? `${c.avgRating.toFixed(1)}★` : "—"}</td>
                </tr>
              ))}
              {data.channels.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-ink-3">Sem menções no período.</td></tr>
              )}
            </tbody>
          </table>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-ink-2">Temas das menções negativas — 30 dias</h2>
          <ul className="space-y-2">
            {data.topics.map((t) => (
              <li key={t.topic} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2 text-sm">
                <span className="truncate">{TOPIC_LABELS[t.topic] ?? t.topic}</span>
                <div className="h-3 rounded-r bg-surface-2">
                  <div className="h-3 rounded-r" style={{ width: `${(t.n / maxTopic) * 100}%`, background: "var(--neg)" }} />
                </div>
                <span className="text-right font-medium">{t.n}</span>
              </li>
            ))}
            {data.topics.length === 0 && <li className="text-sm text-ink-3">Nenhuma menção negativa.</li>}
          </ul>
        </section>
      </div>

      {data.alerts.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-ink-2">Alertas recentes</h2>
          <ul className="divide-y divide-line">
            {data.alerts.map((a) => (
              <li key={a.id} className={`flex items-start gap-3 py-2 text-sm ${a.acknowledged ? "opacity-50" : ""}`}>
                <span aria-hidden>⚠</span>
                <div className="min-w-0 flex-1">
                  <p>{a.title}</p>
                  <p className="text-xs text-ink-3">{a.detail ? `${a.detail} · ` : ""}{fmtDateTime(a.createdAt)}</p>
                </div>
                {!a.acknowledged && (
                  <form action={acknowledgeAlert.bind(null, a.id)}>
                    <SubmitButton className="btn text-xs" pendingText="…">Ciente</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-ink-2">Menções ({data.total})</h2>
          <form className="flex flex-wrap gap-2" method="get">
            <select name="periodo" defaultValue={sp.periodo ?? ""} className="input w-36" aria-label="Período">
              <option value="">Todo período</option>
              {PERIODOS.map((p) => <option key={p} value={p}>Últimos {p} dias</option>)}
            </select>
            <input name="q" defaultValue={sp.q} placeholder="Buscar texto ou autor" className="input w-48" />
            <select name="channel" defaultValue={sp.channel ?? ""} className="input w-36">
              <option value="">Todos os canais</option>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select name="sentiment" defaultValue={sp.sentiment ?? ""} className="input w-36">
              <option value="">Todo sentimento</option>
              <option value="NEGATIVE">Negativas</option>
              <option value="NEUTRAL">Neutras</option>
              <option value="POSITIVE">Positivas</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-ink-2">
              <input type="checkbox" name="all" value="1" defaultChecked={sp.all === "1"} /> incluir irrelevantes
            </label>
            <button className="btn">Filtrar</button>
            {(sp.q || sp.channel || sp.sentiment || sp.all || sp.periodo) && <Link href={`/clients/${id}`} className="btn">Limpar</Link>}
          </form>
        </div>
        <ul>
          {data.mentions.map((m) => <MentionItem key={m.id} m={m} />)}
          {data.mentions.length === 0 && <li className="py-6 text-center text-sm text-ink-3">Nenhuma menção encontrada.</li>}
        </ul>
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            {data.page > 1 && <Link className="btn" href={qs({ page: String(data.page - 1) })}>← Anterior</Link>}
            <span className="text-ink-2">Página {data.page} de {pages}</span>
            {data.page < pages && <Link className="btn" href={qs({ page: String(data.page + 1) })}>Próxima →</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
