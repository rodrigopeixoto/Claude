import type { Client } from "@prisma/client";
import { SubmitButton } from "./SubmitButton";

export function ClientForm({ action, client }: { action: (form: FormData) => Promise<void>; client?: Client }) {
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-6">
      <div>
        <label className="label" htmlFor="name">Nome do cliente</label>
        <input id="name" name="name" className="input" required defaultValue={client?.name} />
      </div>
      <div>
        <label className="label" htmlFor="description">Descrição (contexto para a IA)</label>
        <input id="description" name="description" className="input" defaultValue={client?.description ?? ""} placeholder="Ex.: rede de farmácias do Sul" />
      </div>
      <div>
        <label className="label" htmlFor="keywords">Palavras-chave (uma por linha ou separadas por vírgula)</label>
        <textarea
          id="keywords"
          name="keywords"
          className="input"
          rows={3}
          required
          defaultValue={client?.keywords.join("\n")}
          placeholder={"Nome da marca\nNome do produto\n@perfil"}
        />
        <p className="mt-1 text-xs text-ink-3">Usadas nas buscas de notícias, YouTube e redes. Use nomes específicos para evitar homônimos.</p>
      </div>
      <div>
        <label className="label" htmlFor="excludeTerms">Termos de exclusão</label>
        <textarea id="excludeTerms" name="excludeTerms" className="input" rows={2} defaultValue={client?.excludeTerms.join("\n")} placeholder={"vaga\nconcurso"} />
        <p className="mt-1 text-xs text-ink-3">Menções que contenham estes termos são descartadas na coleta.</p>
      </div>
      {!client && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="defaultSources" defaultChecked /> Criar fontes de notícias padrão (Google News + GDELT)
        </label>
      )}
      <div className="flex gap-2">
        <SubmitButton className="btn btn-primary">{client ? "Salvar" : "Criar cliente"}</SubmitButton>
      </div>
    </form>
  );
}
