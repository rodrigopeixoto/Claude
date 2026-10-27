import Link from "next/link";
import { acknowledgeAlert, acknowledgeAll } from "@/app/actions";
import { fmtDateTime } from "@/components/MentionItem";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const KIND = { SEVERE_MENTION: "Menção crítica", VOLUME_SPIKE: "Pico de negativas", SCORE_DROP: "Queda de saúde" } as const;

export default async function Alerts() {
  const alerts = await prisma.alert.findMany({
    orderBy: [{ acknowledged: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { client: { select: { name: true } }, mention: { select: { url: true } } },
  });
  const open = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Alertas</h1>
          <p className="text-sm text-ink-2">{open} aberto(s)</p>
        </div>
        {open > 0 && (
          <form action={acknowledgeAll}>
            <SubmitButton className="btn" pendingText="…">Marcar todos como ciente</SubmitButton>
          </form>
        )}
      </div>
      <section className="card p-5">
        <ul className="divide-y divide-line">
          {alerts.map((a) => (
            <li key={a.id} className={`flex flex-wrap items-start gap-3 py-3 text-sm ${a.acknowledged ? "opacity-50" : ""}`}>
              <span aria-hidden>⚠</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">
                  <Link href={`/clients/${a.clientId}`} className="font-medium text-ink-2 hover:underline">{a.client.name}</Link> · {KIND[a.kind]} · {fmtDateTime(a.createdAt)}
                </p>
                <p>{a.title}</p>
                {a.detail && <p className="text-xs text-ink-3">{a.detail}</p>}
                {a.mention?.url && (
                  <a href={a.mention.url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">abrir menção</a>
                )}
              </div>
              {!a.acknowledged && (
                <form action={acknowledgeAlert.bind(null, a.id)}>
                  <SubmitButton className="btn text-xs" pendingText="…">Ciente</SubmitButton>
                </form>
              )}
            </li>
          ))}
          {alerts.length === 0 && <li className="py-6 text-center text-ink-3">Nenhum alerta.</li>}
        </ul>
      </section>
    </div>
  );
}
