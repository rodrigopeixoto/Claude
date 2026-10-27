"use client";

import type { Source } from "@prisma/client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteSource, runSourceNow, toggleSource } from "@/app/actions";
import { SOURCE_TEMPLATES } from "@/lib/sourceTemplates";
import { SourceForm } from "./SourceForm";

function ago(d: Date | null) {
  if (!d) return "nunca";
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} d`;
}

export function SourceRow({
  source,
  clientName,
  missingEnv,
}: {
  source: Source;
  clientName?: string;
  missingEnv: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const status = !source.enabled
    ? { icon: "○", text: "Pausada" }
    : source.lastStatus === "ERROR"
      ? { icon: "⨯", text: "Erro" }
      : source.lastStatus === "OK"
        ? { icon: "✓", text: "OK" }
        : { icon: "…", text: "Aguardando 1ª coleta" };

  return (
    <li className="border-b border-line py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {source.name}{" "}
            <span className="text-xs font-normal text-ink-3">
              {SOURCE_TEMPLATES[source.type].label} · a cada {source.intervalMinutes} min
              {clientName && (
                <>
                  {" · "}
                  <Link href={`/clients/${source.clientId}/sources`} className="hover:underline">{clientName}</Link>
                </>
              )}
            </span>
          </p>
          <p className="text-xs text-ink-2">
            <span className="font-medium" style={{ color: source.lastStatus === "ERROR" && source.enabled ? "var(--critical)" : undefined }}>
              {status.icon} {status.text}
            </span>{" "}
            · última coleta {ago(source.lastRunAt)}
            {source.lastStatus === "OK" && source.lastItemsNew != null && ` · ${source.lastItemsNew} novas`}
          </p>
          {source.lastError && source.lastStatus === "ERROR" && (
            <p className="mt-0.5 break-all font-mono text-xs text-ink-2">{source.lastError}</p>
          )}
          {result && <p className="mt-0.5 text-xs text-ink-2">{result}</p>}
        </div>
        <div className="flex gap-2">
          <button
            className="btn text-xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setResult(null);
                const r = await runSourceNow(source.id);
                setResult(r.ok ? `Coleta: ${r.found} encontradas, ${r.inserted} novas.` : `Falhou: ${r.error}`);
              })
            }
          >
            {pending ? "Coletando…" : "Coletar agora"}
          </button>
          <button className="btn text-xs" onClick={() => start(() => toggleSource(source.id))} disabled={pending}>
            {source.enabled ? "Pausar" : "Ativar"}
          </button>
          <button className="btn text-xs" onClick={() => setEditing((e) => !e)}>{editing ? "Fechar" : "Editar"}</button>
          <button
            className="btn btn-danger text-xs"
            disabled={pending}
            onClick={() => {
              if (confirm(`Excluir a fonte "${source.name}"? As menções já coletadas ficam.`)) start(() => deleteSource(source.id));
            }}
          >
            Excluir
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 rounded-lg bg-surface-2 p-4">
          <SourceForm clientId={source.clientId} source={source} missingEnv={missingEnv} onDone={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}
