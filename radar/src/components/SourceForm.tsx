"use client";

import type { Source, SourceType } from "@prisma/client";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveSource, type SourceFormState } from "@/app/actions";
import { SOURCE_TEMPLATES } from "@/lib/sourceTemplates";
import { SubmitButton } from "./SubmitButton";

const TYPES = Object.keys(SOURCE_TEMPLATES) as SourceType[];

export function SourceForm({
  clientId,
  source,
  missingEnv,
  onDone,
}: {
  clientId: string;
  source?: Source;
  missingEnv: string[];
  onDone?: () => void;
}) {
  const [type, setType] = useState<SourceType>(source?.type ?? "GOOGLE_NEWS");
  const [config, setConfig] = useState(JSON.stringify(source?.config ?? SOURCE_TEMPLATES.GOOGLE_NEWS.config, null, 2));
  const [interval, setInterval] = useState(source?.intervalMinutes ?? SOURCE_TEMPLATES.GOOGLE_NEWS.intervalMinutes);
  const [state, action] = useActionState<SourceFormState, FormData>(saveSource, {});
  const formRef = useRef<HTMLFormElement>(null);
  const tpl = SOURCE_TEMPLATES[type];

  useEffect(() => {
    if (!state.ok) return;
    if (!source) {
      formRef.current?.reset();
      setType("GOOGLE_NEWS");
      setConfig(JSON.stringify(SOURCE_TEMPLATES.GOOGLE_NEWS.config, null, 2));
      setInterval(SOURCE_TEMPLATES.GOOGLE_NEWS.intervalMinutes);
    }
    onDone?.();
  }, [state, source, onDone]);

  let jsonError: string | null = null;
  try {
    JSON.parse(config);
  } catch {
    jsonError = "JSON inválido";
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      {source && <input type="hidden" name="id" value={source.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Tipo</label>
          <select
            name="type"
            className="input"
            value={type}
            onChange={(e) => {
              const t = e.target.value as SourceType;
              setType(t);
              setConfig(JSON.stringify(SOURCE_TEMPLATES[t].config, null, 2));
              setInterval(SOURCE_TEMPLATES[t].intervalMinutes);
            }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{SOURCE_TEMPLATES[t].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Nome</label>
          <input name="name" className="input" defaultValue={source?.name} placeholder={tpl.label} />
        </div>
        <div>
          <label className="label">Intervalo (minutos, mín. 15)</label>
          <input name="intervalMinutes" type="number" min={15} className="input" value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
        </div>
      </div>
      <p className="text-xs text-ink-2">{tpl.help}</p>
      {tpl.requires && missingEnv.includes(tpl.requires) && (
        <p className="text-xs font-medium text-ink">⚠ Requer a variável de ambiente {tpl.requires}, que não está configurada no servidor.</p>
      )}
      <div>
        <label className="label">Configuração (JSON)</label>
        <textarea
          name="config"
          className="input font-mono text-xs"
          rows={Math.min(12, config.split("\n").length + 1)}
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          spellCheck={false}
        />
        {jsonError && <p className="mt-1 text-xs" style={{ color: "var(--critical)" }}>{jsonError}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={source?.enabled ?? true} /> Ativa
      </label>
      {state.error && <p className="text-sm" style={{ color: "var(--critical)" }}>{state.error}</p>}
      <SubmitButton className="btn btn-primary">{source ? "Salvar fonte" : "Adicionar fonte"}</SubmitButton>
    </form>
  );
}
