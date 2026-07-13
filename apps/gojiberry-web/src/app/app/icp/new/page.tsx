'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { icpApi, leadsApi } from '@/lib/api';

const EXAMPLES = [
  'VPs de Vendas em empresas SaaS B2B de 50 a 500 funcionários nos EUA',
  'CTOs de fintechs em fase de Series A na América Latina',
  'Head of Growth em marketplaces de e-commerce com menos de 200 funcionários',
];

export default function NewIcpPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState<'prompt' | 'generating' | 'done'>('prompt');
  const [error, setError] = useState('');
  const [icp, setIcp] = useState<any>(null);
  const [leadCount, setLeadCount] = useState(0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStep('generating');
    try {
      const { data: createdIcp } = await icpApi.create(prompt);
      setIcp(createdIcp);
      const { data: leads } = await leadsApi.generate(createdIcp.id, 10);
      setLeadCount(leads.length);
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Falha ao gerar leads');
      setStep('prompt');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Novo ICP</h1>
      <p className="text-gray-500 mb-6">
        Descreva quem é o seu cliente ideal em uma frase. A IA vai transformar isso em critérios
        de busca e gerar uma primeira lista de leads.
      </p>

      {step !== 'done' && (
        <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <textarea
            required
            minLength={10}
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: VPs de Vendas em empresas SaaS B2B de 50 a 500 funcionários nos EUA"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <div className="flex flex-wrap gap-2 mb-6">
            {EXAMPLES.map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => setPrompt(ex)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={step === 'generating'}
            className="w-full bg-brand text-white rounded-lg py-2.5 font-semibold hover:bg-brand-dark transition disabled:opacity-50"
          >
            {step === 'generating' ? 'Gerando lista de leads...' : 'Gerar leads com IA'}
          </button>
        </form>
      )}

      {step === 'done' && icp && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-2xl mb-2">✅</p>
          <h2 className="font-semibold text-gray-900 mb-1">{icp.name}</h2>
          <p className="text-gray-500 mb-6">{leadCount} leads gerados com sucesso.</p>
          <button
            onClick={() => router.push(`/app/leads?icpProfileId=${icp.id}`)}
            className="px-6 py-2.5 bg-brand text-white rounded-lg font-semibold hover:bg-brand-dark"
          >
            Ver leads
          </button>
        </div>
      )}
    </div>
  );
}
