'use client';
import { useState } from 'react';
import { calendarsApi, oauthConfigsApi } from '@/lib/api';

interface Props {
  onClose: () => void;
}

export default function ConnectCalendarModal({ onClose }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [provider, setProvider] = useState<'GOOGLE' | 'MICROSOFT' | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function connect(chosenProvider: 'GOOGLE' | 'MICROSOFT') {
    setError('');
    setSaving(true);
    try {
      let configId: string | undefined;

      if (showAdvanced && clientId && clientSecret) {
        const res = await oauthConfigsApi.create({
          provider: chosenProvider,
          label: label || `${chosenProvider} custom`,
          clientId,
          clientSecret,
        });
        configId = res.data.id;
      }

      const getter = chosenProvider === 'GOOGLE'
        ? calendarsApi.getGoogleAuthUrl
        : calendarsApi.getMicrosoftAuthUrl;

      const res = await getter(configId);
      window.location.href = res.data.url;
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao iniciar conexão');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Conectar Calendário</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-6">
          Conecte seu calendário para que o sistema possa encontrar horários disponíveis automaticamente.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => connect('GOOGLE')}
            disabled={saving}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
          >
            <GoogleIcon />
            <span className="font-medium text-gray-800">Conectar Google Calendar</span>
          </button>

          <button
            onClick={() => connect('MICROSOFT')}
            disabled={saving}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
          >
            <MicrosoftIcon />
            <span className="font-medium text-gray-800">Conectar Microsoft / Outlook</span>
          </button>
        </div>

        <div className="mt-6">
          <button
            className="text-sm text-indigo-600 hover:underline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '- Ocultar credenciais personalizadas' : '+ Usar Client ID / Secret próprio'}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">
                Opcional: use seu próprio app OAuth registrado no Google Cloud ou Azure.
              </p>
              <input
                type="text"
                placeholder="Label (ex: Minha Empresa)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
              />
              <input
                type="password"
                placeholder="Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
              />
              <p className="text-xs text-gray-400">
                Escolha o provider acima após preencher as credenciais.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}

        {saving && (
          <p className="mt-4 text-sm text-gray-500 text-center">Redirecionando...</p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  );
}
