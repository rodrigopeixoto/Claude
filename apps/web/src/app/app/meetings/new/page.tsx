'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { meetingsApi } from '@/lib/api';

export default function NewMeetingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    durationMin: 60,
    dateRangeStart: '',
    dateRangeEnd: '',
    timeWindowStart: '09:00',
    timeWindowEnd: '18:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await meetingsApi.create({ ...form, durationMin: Number(form.durationMin) });
      router.push(`/app/meetings/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar reunião');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Reunião</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <Field label="Título *">
          <input required value={form.title} onChange={update('title')} className={input} placeholder="Ex: Sync Semanal" />
        </Field>
        <Field label="Descrição">
          <textarea value={form.description} onChange={update('description')} className={`${input} h-20`} placeholder="Detalhes opcionais" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duração (min) *">
            <select value={form.durationMin} onChange={update('durationMin')} className={input}>
              {[15, 30, 45, 60, 90, 120].map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </Field>
          <Field label="Fuso horário">
            <input value={form.timezone} onChange={update('timezone')} className={input} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data início *">
            <input type="date" required value={form.dateRangeStart} onChange={update('dateRangeStart')} className={input} />
          </Field>
          <Field label="Data fim *">
            <input type="date" required value={form.dateRangeEnd} onChange={update('dateRangeEnd')} className={input} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Horário início">
            <input type="time" value={form.timeWindowStart} onChange={update('timeWindowStart')} className={input} />
          </Field>
          <Field label="Horário fim">
            <input type="time" value={form.timeWindowEnd} onChange={update('timeWindowEnd')} className={input} />
          </Field>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Criando...' : 'Criar Reunião'}
        </button>
      </form>
    </div>
  );
}

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
