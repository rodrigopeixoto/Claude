import type { Mention } from "@prisma/client";
import { toggleRelevant } from "@/app/actions";
import { CHANNEL_LABELS, TOPIC_LABELS } from "@/lib/sourceTemplates";
import { truncate } from "@/lib/text";
import { SubmitButton } from "./SubmitButton";

const SENT = {
  POSITIVE: { label: "Positiva", color: "var(--pos)" },
  NEUTRAL: { label: "Neutra", color: "var(--neu)" },
  NEGATIVE: { label: "Negativa", color: "var(--neg)" },
} as const;

const SEVERITY = ["", "baixa", "relevante", "crítica"];

export function fmtDateTime(d: Date) {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function MentionItem({ m }: { m: Mention }) {
  const sent = m.sentimentLabel ? SENT[m.sentimentLabel] : null;
  const body = m.title && m.content.startsWith(m.title) ? m.content.slice(m.title.length).replace(/^[.\s]+/, "") : m.content;
  return (
    <li className={`border-b border-line py-3 last:border-0 ${m.relevant ? "" : "opacity-50"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium">{CHANNEL_LABELS[m.channel]}</span>
        {sent ? (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: sent.color }} />
            {sent.label}
          </span>
        ) : (
          <span className="text-ink-3">não analisada</span>
        )}
        {m.rating != null && <span>{"★".repeat(m.rating)}{"☆".repeat(Math.max(0, 5 - m.rating))}</span>}
        {m.topic && <span>{TOPIC_LABELS[m.topic] ?? m.topic}</span>}
        {(m.severity ?? 0) >= 2 && <span className="font-medium text-ink">⚠ severidade {SEVERITY[m.severity!]}</span>}
        {m.isComplaint && <span>reclamação</span>}
        <span className="ml-auto text-ink-3">
          {m.author ? `${m.author} · ` : ""}
          {fmtDateTime(m.publishedAt)}
        </span>
      </div>
      <div className="mt-1.5">
        {m.title && (
          <p className="font-medium">
            {m.url ? (
              <a href={m.url} target="_blank" rel="noreferrer" className="hover:underline">
                {m.title}
              </a>
            ) : (
              m.title
            )}
          </p>
        )}
        {body && <p className="text-sm text-ink-2">{truncate(body, 400)}</p>}
        {m.summary && m.analysisMethod === "llm" && <p className="mt-1 text-xs text-ink-3">IA: {m.summary}</p>}
      </div>
      <div className="mt-1 flex gap-3 text-xs">
        {m.url && !m.title && (
          <a href={m.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            abrir
          </a>
        )}
        <form action={toggleRelevant.bind(null, m.id)}>
          <SubmitButton className="text-ink-3 hover:text-ink" pendingText="…">
            {m.relevant ? "marcar como irrelevante" : "marcar como relevante"}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
