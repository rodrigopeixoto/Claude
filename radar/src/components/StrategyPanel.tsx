import type { Strategy } from "@/lib/strategy";
import { StrategyButton } from "./StrategyButton";

const LEVEL = { baixo: "Baixo", medio: "Médio", alto: "Alto" } as const;
const TIPO = {
  negativo: { label: "Negativo", icon: "▼", color: "var(--critical)" },
  atencao: { label: "Atenção", icon: "!", color: "var(--warning)" },
  positivo: { label: "Positivo", icon: "▲", color: "var(--good)" },
} as const;

export function StrategyPanel({
  clientId,
  report,
}: {
  clientId: string;
  report: { createdAt: Date; model: string; data: Strategy } | null;
}) {
  const d = report?.data;
  const order = { negativo: 0, atencao: 1, positivo: 2 };
  return (
    <section className="card p-5" id="estrategia">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink-2">Leitura estratégica</h2>
          <p className="text-xs text-ink-3">
            {report
              ? `${report.model.startsWith("leitura inicial") ? "Leitura inicial, feita com pesquisa de 27/10/2026" : `Gerada por IA (${report.model}) em ${report.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}, cruzando reputação, bolsa, notícias, macro e segmento.`
              : "Cruza reputação, bolsa, notícias do cliente, cenário macro e do segmento para avaliar risco de cancelamento, potencial de expansão e sinais para a operação de UX."}
          </p>
        </div>
        <StrategyButton clientId={clientId} hasReport={Boolean(report)} />
      </div>
      {d && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Risco de cancelamento", d.risco_cancelamento],
              ["Potencial de expansão", d.potencial_expansao],
            ].map(([label, v]) => {
              const x = v as Strategy["risco_cancelamento"];
              return (
                <div key={label as string} className="rounded-lg bg-surface-2 p-3">
                  <p className="text-xs text-ink-3">{label as string}</p>
                  <p className="text-lg font-semibold">{LEVEL[x.nivel]}</p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-ink-2">{x.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div><p className="text-xs font-medium text-ink-3">Cenário macro</p><p className="text-ink-2">{d.leitura_macro}</p></div>
            <div><p className="text-xs font-medium text-ink-3">Segmento</p><p className="text-ink-2">{d.leitura_segmento}</p></div>
            <div><p className="text-xs font-medium text-ink-3">Cliente</p><p className="text-ink-2">{d.leitura_cliente}</p></div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-xs font-medium text-ink-3">Impacto no outsourcing de UX</p><p className="text-ink-2">{d.impacto_ux.outsourcing}</p></div>
            <div><p className="text-xs font-medium text-ink-3">Impacto no hunting de UX</p><p className="text-ink-2">{d.impacto_ux.hunting}</p></div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-ink-3">Sinais e planos de ação</p>
            <ul className="space-y-3">
              {[...d.sinais].sort((a, b) => order[a.tipo] - order[b.tipo]).map((s, i) => (
                <li key={i} className="rounded-lg border border-line p-3 text-sm">
                  <p className="font-medium">
                    <span style={{ color: TIPO[s.tipo].color }} aria-hidden>{TIPO[s.tipo].icon} </span>
                    <span className="text-xs text-ink-3">{TIPO[s.tipo].label} · </span>
                    {s.titulo}
                  </p>
                  <p className="mt-1 text-ink-2"><span className="text-xs text-ink-3">Evidência: </span>{s.evidencia}</p>
                  <p className="text-ink-2"><span className="text-xs text-ink-3">Impacto: </span>{s.impacto}</p>
                  <div className="mt-1">
                    <span className="text-xs text-ink-3">Plano de ação ({s.prazo} · {s.responsavel}):</span>
                    <ol className="list-decimal pl-5 text-ink-2">{s.plano_acao.map((p, j) => <li key={j}>{p}</li>)}</ol>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
