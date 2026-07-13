'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { leadsApi } from '@/lib/api';

const DEPARTMENTS = [
  'executive', 'it', 'finance', 'management', 'sales', 'legal',
  'support', 'hr', 'marketing', 'communication', 'education', 'design', 'health', 'operations',
];
const SENIORITIES = ['junior', 'senior', 'executive'];

export default function RealLeadsPage() {
  const router = useRouter();
  const [domainsText, setDomainsText] = useState('');
  const [department, setDepartment] = useState('');
  const [seniority, setSeniority] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any[] | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    const domains = domainsText
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (domains.length === 0) {
      setError('Informe pelo menos um domínio.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await leadsApi.sourceReal(domains, {
        department: department || undefined,
        seniority: seniority || undefined,
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Falha ao buscar leads reais');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Buscar leads reais</h1>
      <p className="text-gray-500 mb-6">
        Diferente do modo demo (que gera empresas fictícias com IA), aqui buscamos pessoas
        reais — com emails reais e verificados — nos domínios de empresa que você informar,
        via <span className="font-medium">Hunter.io</span>. O Hunter não descobre empresas por
        setor/tamanho, então você precisa saber o domínio de antemão.
      </p>

      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Domínios (um por linha, até 10)
        </label>
        <textarea
          required
          rows={5}
          value={domainsText}
          onChange={(e) => setDomainsText(e.target.value)}
          placeholder={'stripe.com\nnotion.so\nramp.com'}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 font-mono"
        />

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Departamento (opcional)
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Qualquer</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Senioridade (opcional)
            </label>
            <select
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Qualquer</option>
              {SENIORITIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white rounded-lg py-2.5 font-semibold hover:bg-brand-dark transition disabled:opacity-50"
        >
          {loading ? 'Buscando na Hunter.io...' : 'Buscar leads reais'}
        </button>
      </form>

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
          {result.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum contato novo encontrado nesses domínios (ou já estavam cadastrados).
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">{result.length} lead(s) real(is) encontrado(s):</p>
              <ul className="space-y-2 mb-4">
                {result.map((lead) => (
                  <li key={lead.id} className="text-sm border-b border-gray-100 pb-2 last:border-0">
                    <span className="font-medium text-gray-900">{lead.fullName}</span>
                    {' — '}
                    <span className="text-gray-600">{lead.title} @ {lead.company}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {lead.email} ({lead.emailStatus ?? 'unverified'})
                    </span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push('/app/leads')}
                className="text-sm text-brand-dark font-medium hover:underline"
              >
                Ver todos os leads →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
