import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl font-bold text-indigo-700 mb-4">Meet Scheduler</h1>
        <p className="text-xl text-gray-600 mb-8">
          Encontre o horário perfeito para sua reunião entre pessoas de diferentes organizações
          — Google Calendar, Microsoft Outlook e mais.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/app/meetings/new"
            className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Agendar reunião
          </Link>
          <Link
            href="/app/dashboard"
            className="px-8 py-3 border border-indigo-300 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-50 transition"
          >
            Entrar
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          {[
            {
              icon: '📅',
              title: 'Multi-plataforma',
              desc: 'Conecta Google Calendar, Microsoft Outlook e mais em uma só interface.',
            },
            {
              icon: '🔒',
              title: 'Privacidade total',
              desc: 'Vemos apenas se você está livre ou ocupado — nunca os detalhes dos seus eventos.',
            },
            {
              icon: '🔗',
              title: 'API para integrações',
              desc: 'Consuma via REST API com API key. Webhooks para notificações em tempo real.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
