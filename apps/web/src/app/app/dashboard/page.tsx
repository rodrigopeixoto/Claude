'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { meetingsApi, calendarsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import ConnectCalendarModal from '@/components/ConnectCalendarModal';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberta',
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      meetingsApi.list(),
      calendarsApi.list(),
    ])
      .then(([meetRes, calRes]) => {
        setMeetings(meetRes.data);
        setConnections(calRes.data);
        if (calRes.data.length === 0) {
          setShowModal(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {showModal && <ConnectCalendarModal onClose={() => setShowModal(false)} />}

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Suas Reuniões</h1>
        <Link
          href="/app/meetings/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + Nova Reunião
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        {connections.length === 0 ? (
          <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            Nenhum calendário conectado
          </span>
        ) : (
          <span className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full">
            {connections.length} calendário(s) conectado(s)
          </span>
        )}
        <button
          onClick={() => setShowModal(true)}
          className="text-sm text-indigo-600 hover:underline"
        >
          + Conectar calendário
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : meetings.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">Nenhuma reunião ainda.</p>
          <Link href="/app/meetings/new" className="text-indigo-600 underline">
            Criar sua primeira reunião
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((m) => (
            <Link
              key={m.id}
              href={`/app/meetings/${m.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{m.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDate(m.dateRangeStart)} → {formatDate(m.dateRangeEnd)} · {m.durationMin}min
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {m.participants.length} participante(s) ·{' '}
                    {m.participants.filter((p: any) => p.status === 'CONNECTED').length} conectado(s)
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[m.status]}`}>
                  {STATUS_LABELS[m.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
