'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { leadsApi, signalsApi, messagesApi } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

const SIGNAL_LABELS: Record<string, string> = {
  JOB_CHANGE: 'Mudança de emprego',
  FUNDING_ROUND: 'Rodada de investimento',
  LINKEDIN_ENGAGEMENT: 'Engajamento no LinkedIn',
  CONTENT_POST: 'Novo conteúdo publicado',
  HIRING_SURGE: 'Onda de contratação',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<{ subject: string; body: string } | null>(null);

  async function load() {
    const [{ data: leadData }, { data: msgs }] = await Promise.all([
      leadsApi.get(id),
      messagesApi.list(id),
    ]);
    setLead(leadData);
    setMessages(msgs);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [id]);

  async function refreshSignals() {
    setRefreshing(true);
    try {
      await signalsApi.refresh(id);
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function generateMessage() {
    setGenerating(true);
    try {
      const { data } = await messagesApi.generate(id);
      setMessages((prev) => [data, ...prev]);
      setEditing({ subject: data.subject ?? '', body: data.body });
    } finally {
      setGenerating(false);
    }
  }

  async function saveAndSend(messageId: string) {
    if (editing) await messagesApi.update(messageId, editing);
    await messagesApi.send(messageId);
    setEditing(null);
    await load();
  }

  if (loading || !lead) return <p className="text-gray-500">Carregando...</p>;

  const enrichment = lead.enrichment ?? {};
  const draftMessage = messages.find((m) => m.status === 'DRAFT');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{lead.fullName}</h1>
              <p className="text-gray-600">{lead.title} · {lead.company}</p>
              <p className="text-sm text-gray-400 mt-1">{lead.location}</p>
            </div>
            <span className="text-sm px-3 py-1 rounded-full bg-brand-light/20 text-brand-dark font-semibold">
              Score {lead.intentScore}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
            <Info label="Setor" value={lead.industry} />
            <Info label="Tamanho da empresa" value={lead.companySize} />
            <Info label="Funcionários (estimado)" value={enrichment.employeeCount} />
            <Info label="Receita estimada" value={enrichment.estimatedRevenue} />
            <Info label="Stack de tecnologia" value={enrichment.techStack?.join(', ')} />
            <Info
              label="LinkedIn"
              value={lead.linkedinUrl ? 'perfil vinculado' : undefined}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Sinais de intenção de compra</h2>
            <button
              onClick={refreshSignals}
              disabled={refreshing}
              className="text-sm text-brand-dark font-medium hover:underline disabled:opacity-50"
            >
              {refreshing ? 'Buscando...' : 'Buscar novos sinais'}
            </button>
          </div>

          {lead.signals?.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum sinal detectado ainda.</p>
          ) : (
            <ul className="space-y-3">
              {lead.signals?.map((s: any) => (
                <li key={s.id} className="border-l-2 border-brand pl-3">
                  <p className="text-sm font-medium text-gray-900">
                    {SIGNAL_LABELS[s.type] ?? s.type}
                  </p>
                  <p className="text-sm text-gray-500">{s.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(s.detectedAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-400 mt-4">
            Sinais gerados por um provedor de demonstração (dados fictícios) — pronto para ser
            substituído por um provedor real e compatível com os termos de uso do LinkedIn.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Outreach com IA</h2>
            <button
              onClick={generateMessage}
              disabled={generating}
              className="text-sm bg-brand text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-dark disabled:opacity-50"
            >
              {generating ? 'Gerando...' : 'Gerar mensagem'}
            </button>
          </div>

          {editing && draftMessage ? (
            <div>
              <input
                value={editing.subject}
                onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                placeholder="Assunto"
              />
              <textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
              />
              <button
                onClick={() => saveAndSend(draftMessage.id)}
                className="w-full bg-brand-ink text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90"
              >
                Salvar e enviar
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Gere uma mensagem personalizada com base no cargo, empresa e sinais mais recentes.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Histórico</h2>
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma mensagem ainda.</p>
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => (
                <li key={m.id} className="text-sm border-b border-gray-100 pb-3 last:border-0">
                  <p className="font-medium text-gray-900">{m.subject ?? '(sem assunto)'}</p>
                  <p className="text-gray-500 line-clamp-2">{m.body}</p>
                  <span
                    className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.status === 'SENT'
                        ? 'bg-green-100 text-green-700'
                        : m.status === 'FAILED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className="text-gray-900 font-medium">{value ?? '—'}</p>
    </div>
  );
}
