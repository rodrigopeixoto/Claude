'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { campaignsApi, leadsApi } from '@/lib/api';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  async function load() {
    const [{ data: c }, { data: leads }] = await Promise.all([campaignsApi.get(id), leadsApi.list()]);
    setCampaign(c);
    setAllLeads(leads);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [id]);

  async function toggleStatus() {
    const next = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await campaignsApi.setStatus(id, next);
    await load();
  }

  async function enroll() {
    if (selected.length === 0) return;
    setEnrolling(true);
    try {
      await campaignsApi.enroll(id, selected);
      setSelected([]);
      await load();
    } finally {
      setEnrolling(false);
    }
  }

  if (loading || !campaign) return <p className="text-gray-500">Carregando...</p>;

  const enrolledIds = new Set(campaign.enrollments.map((e: any) => e.leadId));
  const availableLeads = allLeads.filter((l) => !enrolledIds.has(l.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <button
              onClick={toggleStatus}
              className={`text-sm px-4 py-2 rounded-lg font-medium ${
                campaign.status === 'ACTIVE'
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-brand text-white hover:bg-brand-dark'
              }`}
            >
              {campaign.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">Status: {campaign.status}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Etapas</h2>
          <ol className="space-y-4">
            {campaign.steps.map((s: any) => (
              <li key={s.id} className="border-l-2 border-brand pl-3">
                <p className="text-sm font-medium text-gray-900">
                  Etapa {s.order + 1} — {s.delayDays === 0 ? 'imediata' : `após ${s.delayDays} dia(s)`}
                </p>
                {s.subjectTemplate && <p className="text-sm text-gray-600">{s.subjectTemplate}</p>}
                <p className="text-sm text-gray-400 whitespace-pre-wrap">{s.bodyTemplate}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Leads inscritos ({campaign.enrollments.length})</h2>
          {campaign.enrollments.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum lead inscrito ainda.</p>
          ) : (
            <ul className="space-y-2">
              {campaign.enrollments.map((e: any) => (
                <li key={e.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                  <span className="text-gray-900">{e.lead.fullName} — {e.lead.company}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {e.status} · etapa {e.currentStep}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit">
        <h2 className="font-semibold text-gray-900 mb-4">Inscrever leads</h2>
        {availableLeads.length === 0 ? (
          <p className="text-sm text-gray-400">Todos os leads já estão inscritos.</p>
        ) : (
          <>
            <ul className="space-y-2 max-h-80 overflow-y-auto mb-4">
              {availableLeads.map((lead) => (
                <li key={lead.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(lead.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, lead.id] : prev.filter((id) => id !== lead.id),
                        )
                      }
                    />
                    <span>{lead.fullName} — {lead.company}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              onClick={enroll}
              disabled={enrolling || selected.length === 0}
              className="w-full bg-brand text-white rounded-lg py-2 text-sm font-semibold hover:bg-brand-dark disabled:opacity-50"
            >
              {enrolling ? 'Inscrevendo...' : `Inscrever ${selected.length || ''} lead(s)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
