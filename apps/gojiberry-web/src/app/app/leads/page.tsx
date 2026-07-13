'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { leadsApi } from '@/lib/api';

function scoreColor(score: number) {
  if (score >= 60) return 'bg-red-100 text-red-700';
  if (score >= 30) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

export default function LeadsPage() {
  const params = useSearchParams();
  const icpProfileId = params.get('icpProfileId') ?? undefined;
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leadsApi
      .list(icpProfileId)
      .then(({ data }) => setLeads(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [icpProfileId]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Leads</h1>

      {loading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">Nenhum lead ainda.</p>
          <Link href="/app/icp/new" className="text-brand-dark underline font-medium">
            Gerar leads a partir de um prompt
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Setor</th>
                <th className="px-4 py-3 font-medium">Sinais</th>
                <th className="px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/app/leads/${lead.id}`} className="font-medium text-brand-dark">
                      {lead.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.title}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.company}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{lead._count?.signals ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${scoreColor(lead.intentScore)}`}>
                      {lead.intentScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
