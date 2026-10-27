import type { AccountHealth } from "@/lib/health/account";
import { CHANNEL_LABELS } from "@/lib/sourceTemplates";
import { ScoreNumber, StatusChip } from "./ScoreBadge";
import { Motivos, Stars } from "./Signals";

export function AccountPanel({
  account,
  ratings,
}: {
  account: AccountHealth;
  ratings: { avg: number | null; count: number; byStore: { channel: string; avg: number | null; count: number }[] };
}) {
  return (
    <section className="card grid gap-5 p-5 lg:grid-cols-3" id="saude-conta">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-2">Saúde da conta</h2>
          <StatusChip score={account.score} />
        </div>
        <div className="mt-2"><ScoreNumber score={account.score} size="xl" /></div>
        <p className="mt-1 text-xs text-ink-3">
          Cruza reputação (o que se fala do cliente), bolsa comparada ao índice (o que é da empresa e não do mercado) e leitura estratégica (risco de cancelamento e expansão).
        </p>
        <ul className="mt-3 space-y-2">
          {account.components.map((c) => (
            <li key={c.key} className="text-sm">
              <div className="flex justify-between">
                <span>{c.label} <span className="text-xs text-ink-3">· peso {Math.round(c.weight * 100)}%</span></span>
                <span className="font-medium">{Math.round(c.score)}</span>
              </div>
              <p className="text-xs text-ink-3">{c.detail}</p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-medium text-ink-2">Por que essa faixa</h3>
        <div className="mt-2"><Motivos items={account.motivos} max={8} /></div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-ink-2">Nota nas lojas (30 dias)</h3>
        {ratings.count ? (
          <>
            <p className="mt-1 text-3xl font-semibold"><Stars avg={ratings.avg} /></p>
            <p className="text-xs text-ink-3">média de {ratings.count} avaliações</p>
            <ul className="mt-2 space-y-1 text-sm">
              {ratings.byStore.map((s) => (
                <li key={s.channel} className="flex justify-between">
                  <span>{CHANNEL_LABELS[s.channel] ?? s.channel}</span>
                  <span><Stars avg={s.avg} /> <span className="text-xs text-ink-3">({s.count})</span></span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-3">Nenhum app monitorado ou sem avaliações em 30 dias.</p>
        )}
      </div>
    </section>
  );
}

/** How sentiment is scored, shown next to the reputation breakdown. */
export function SentimentHelp({ llm }: { llm: boolean }) {
  return (
    <details className="mt-3 text-xs text-ink-2">
      <summary className="cursor-pointer text-ink-3">Como o sentimento é calculado</summary>
      <div className="mt-2 space-y-1.5">
        <p>Cada menção recebe uma nota de −1 (muito negativa para a marca) a +1 (muito positiva). Até −0,25 conta como negativa; a partir de +0,25, positiva; no meio, neutra.</p>
        {llm ? (
          <p>A classificação é feita pelo Claude, que lê o texto e avalia o impacto para a reputação do cliente (não o tom geral do texto). Ele também marca menções irrelevantes (homônimos), o tema, a severidade (0 a 3) e se é reclamação.</p>
        ) : (
          <p>Sem chave da Anthropic, o Radar usa uma heurística local: conta palavras positivas e negativas de um dicionário em português. Em avaliações de app, a nota pesa 70% (1★ = −1, 3★ = 0, 5★ = +1) e o texto 30%. Termos como golpe, fraude, vazamento e Procon elevam a severidade. É menos precisa: não entende ironia nem diferencia homônimos.</p>
        )}
        <p>O componente Sentimento do score é a média dessas notas nos últimos 7 dias, com mais peso para menções de maior engajamento (curtidas, comentários), convertida para 0–100: −1 vira 0, 0 vira 50 e +1 vira 100.</p>
      </div>
    </details>
  );
}
