'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { icpApi, leadsApi, campaignsApi } from '@/lib/api';

export default function DashboardPage() {
  const [icps, setIcps] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([icpApi.list(), leadsApi.list(), campaignsApi.list()])
      .then(([icpRes, leadsRes, campaignsRes]) => {
        setIcps(icpRes.data);
        setLeads(leadsRes.data);
        setCampaigns(campaignsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hotLeads = leads.filter((l) => l.intentScore >= 40).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Visão geral</h1>
        <Link
          href="/app/icp/new"
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark"
        >
          + Gerar leads a partir de um prompt
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
        <Stat label="ICPs criados" value={icps.length} />
        <Stat label="Leads" value={leads.length} />
        <Stat label="Leads quentes (score ≥ 40)" value={hotLeads} />
        <Stat label="Campanhas" value={campaigns.length} />
      </div>

      {loading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : icps.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">
            Você ainda não criou nenhum ICP. Descreva seu cliente ideal em uma frase e deixe a IA
            montar sua primeira lista de leads.
          </p>
          <Link href="/app/icp/new" className="text-brand-dark underline font-medium">
            Criar meu primeiro ICP
          </Link>
        </div>
      ) : (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Seus ICPs</h2>
          <div className="space-y-3">
            {icps.map((icp) => (
              <div
                key={icp.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{icp.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{icp.prompt}</p>
                </div>
                <span className="text-sm text-gray-500">{icp._count?.leads ?? 0} leads</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-3xl font-bold text-brand-ink">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
