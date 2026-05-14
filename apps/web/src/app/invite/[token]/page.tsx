'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { inviteApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState('');
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    inviteApi.getDetails(token)
      .then((r) => setInvite(r.data))
      .catch(() => setError('Convite inválido ou expirado.'));
  }, [token]);

  const decline = async () => {
    setDeclining(true);
    await inviteApi.decline(token);
    setDeclined(true);
    setDeclining(false);
  };

  if (error) return (
    <PageShell>
      <p className="text-red-600 text-center">{error}</p>
    </PageShell>
  );

  if (!invite) return (
    <PageShell>
      <p className="text-gray-500 text-center">Carregando convite...</p>
    </PageShell>
  );

  if (declined) return (
    <PageShell>
      <div className="text-center">
        <p className="text-gray-700 font-semibold">Convite recusado.</p>
        <p className="text-gray-500 text-sm mt-2">O organizador será notificado.</p>
      </div>
    </PageShell>
  );

  if (invite.participant.status === 'CONNECTED') return (
    <PageShell>
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-gray-700 font-semibold text-lg">Calendário já conectado!</p>
        <p className="text-gray-500 text-sm mt-2">
          Sua disponibilidade foi compartilhada de forma anônima para <strong>{invite.meeting.title}</strong>.
        </p>
      </div>
    </PageShell>
  );

  return (
    <PageShell>
      <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Você foi convidado!</h1>
      <p className="text-gray-500 text-sm text-center mb-6">
        Olá {invite.participant.name || invite.participant.email}
      </p>

      <div className="bg-indigo-50 rounded-xl p-4 mb-6">
        <h2 className="font-semibold text-indigo-900">{invite.meeting.title}</h2>
        {invite.meeting.description && (
          <p className="text-indigo-700 text-sm mt-1">{invite.meeting.description}</p>
        )}
        <p className="text-indigo-600 text-sm mt-2">
          {formatDate(invite.meeting.dateRangeStart)} → {formatDate(invite.meeting.dateRangeEnd)} ·{' '}
          {invite.meeting.durationMin} min
        </p>
      </div>

      <p className="text-sm text-gray-600 text-center mb-6">
        Para ajudar a encontrar um horário em comum, conecte seu calendário.
        <strong> Apenas sua disponibilidade (livre/ocupado) é verificada — nunca os detalhes dos seus eventos.</strong>
      </p>

      <div className="space-y-3">
        <a
          href={`${API_URL}/invite/${token}/connect/google`}
          className="flex items-center justify-center gap-3 w-full py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition font-medium text-gray-800"
        >
          <GoogleIcon />
          Conectar com Google Calendar
        </a>
        <a
          href={`${API_URL}/invite/${token}/connect/microsoft`}
          className="flex items-center justify-center gap-3 w-full py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition font-medium text-gray-800"
        >
          <MicrosoftIcon />
          Conectar com Microsoft Outlook
        </a>
      </div>

      <button
        onClick={decline}
        disabled={declining}
        className="w-full mt-4 text-sm text-gray-400 hover:text-red-500 transition py-2"
      >
        {declining ? 'Recusando...' : 'Recusar convite'}
      </button>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full">
        {children}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}
