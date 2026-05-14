'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { meetingsApi } from '@/lib/api';
import { formatDateTime, formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirming, setConfirming] = useState('');

  const load = () => meetingsApi.get(id).then((r) => setMeeting(r.data));

  useEffect(() => { load(); }, [id]);

  const loadSlots = async () => {
    setLoadingSlots(true);
    try {
      const res = await meetingsApi.getSlots(id);
      setSlots(res.data);
    } finally {
      setLoadingSlots(false);
    }
  };

  const addParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    await meetingsApi.addParticipant(id, newEmail);
    setNewEmail('');
    load();
  };

  const confirmSlot = async (slotStart: string) => {
    setConfirming(slotStart);
    await meetingsApi.confirm(id, slotStart);
    load();
    setConfirming('');
  };

  if (!meeting) return <p className="text-gray-500">Carregando...</p>;

  const isOpen = meeting.status === 'OPEN' || meeting.status === 'DRAFT';

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
          {meeting.description && <p className="text-gray-500 mt-1">{meeting.description}</p>}
          <p className="text-sm text-gray-400 mt-1">
            {formatDate(meeting.dateRangeStart)} → {formatDate(meeting.dateRangeEnd)} ·
            {meeting.durationMin}min · {meeting.timezone}
          </p>
        </div>
        <span className="text-sm px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
          {meeting.status}
        </span>
      </div>

      {meeting.status === 'CONFIRMED' && meeting.confirmedSlotStart && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-800 font-semibold">
            Reunião confirmada para {formatDateTime(meeting.confirmedSlotStart, meeting.timezone)}
          </p>
        </div>
      )}

      {/* Participants */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Participantes</h2>
        {meeting.participants.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum participante ainda.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {meeting.participants.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{p.name || p.email}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === 'CONNECTED' ? 'bg-green-100 text-green-700' :
                  p.status === 'DECLINED' ? 'bg-red-100 text-red-600' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {p.status === 'CONNECTED' ? 'Conectado' : p.status === 'DECLINED' ? 'Recusou' : 'Pendente'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {isOpen && (
          <form onSubmit={addParticipant} className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@empresa.com"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Adicionar
            </button>
          </form>
        )}
      </section>

      {/* Available Slots */}
      {isOpen && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Horários Disponíveis</h2>
            <button
              onClick={loadSlots}
              disabled={loadingSlots}
              className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
            >
              {loadingSlots ? 'Calculando...' : 'Atualizar'}
            </button>
          </div>

          {slots.length === 0 && !loadingSlots && (
            <p className="text-gray-400 text-sm">
              {meeting.participants.filter((p: any) => p.status === 'CONNECTED').length === 0
                ? 'Aguardando participantes conectarem seus calendários.'
                : 'Nenhum horário comum encontrado no período.'}
            </p>
          )}

          <div className="space-y-2">
            {slots.map((slot: any) => (
              <div key={slot.start} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {formatDateTime(slot.start, meeting.timezone)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {slot.connectedParticipants}/{slot.totalParticipants} participantes verificados
                  </p>
                </div>
                <button
                  onClick={() => confirmSlot(slot.start)}
                  disabled={confirming === slot.start}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {confirming === slot.start ? '...' : 'Confirmar'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
