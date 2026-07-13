'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { campaignsApi } from '@/lib/api';

interface StepForm {
  order: number;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

const EMPTY_STEP = (order: number): StepForm => ({
  order,
  delayDays: order === 0 ? 0 : 3,
  subjectTemplate: '',
  bodyTemplate: '',
});

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<StepForm[]>([EMPTY_STEP(0)]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateStep(i: number, patch: Partial<StepForm>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, EMPTY_STEP(prev.length)]);
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx })));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await campaignsApi.create({ name, steps });
      router.push(`/app/campaigns/${data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Falha ao criar campanha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova campanha</h1>

      <form onSubmit={onSubmit} className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da campanha</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Sequência de boas-vindas Q3"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {steps.map((step, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Etapa {i + 1}</h3>
              {steps.length > 1 && (
                <button type="button" onClick={() => removeStep(i)} className="text-xs text-red-500">
                  Remover
                </button>
              )}
            </div>

            <label className="block text-xs font-medium text-gray-500 mb-1">
              Aguardar (dias após etapa anterior)
            </label>
            <input
              type="number"
              min={0}
              value={step.delayDays}
              onChange={(e) => updateStep(i, { delayDays: Number(e.target.value) })}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
            />

            <label className="block text-xs font-medium text-gray-500 mb-1">Assunto</label>
            <input
              value={step.subjectTemplate}
              onChange={(e) => updateStep(i, { subjectTemplate: e.target.value })}
              placeholder="Ex: Rápida pergunta para {{firstName}}"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
            />

            <label className="block text-xs font-medium text-gray-500 mb-1">
              Mensagem (use {'{{firstName}}'}, {'{{company}}'}, {'{{title}}'})
            </label>
            <textarea
              required
              rows={4}
              value={step.bodyTemplate}
              onChange={(e) => updateStep(i, { bodyTemplate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addStep}
          className="text-sm text-brand-dark font-medium hover:underline"
        >
          + Adicionar etapa
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white rounded-lg py-2.5 font-semibold hover:bg-brand-dark transition disabled:opacity-50"
        >
          {loading ? 'Criando...' : 'Criar campanha'}
        </button>
      </form>
    </div>
  );
}
