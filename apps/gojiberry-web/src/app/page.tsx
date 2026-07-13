import Link from 'next/link';

const FEATURES = [
  {
    icon: '🎯',
    title: 'Liste leads com um prompt',
    desc: 'Descreva seu cliente ideal em uma frase. A IA monta a lista de leads dentro do seu ICP — cargo, setor, tamanho de empresa e região.',
  },
  {
    icon: '📡',
    title: 'Sinais de intenção de compra',
    desc: 'Acompanhe mudanças de emprego, rodadas de investimento e sinais de engajamento para saber quem está pronto para conversar agora.',
  },
  {
    icon: '✍️',
    title: 'Outreach personalizado por IA',
    desc: 'Mensagens geradas automaticamente para cada lead, considerando o cargo, a empresa e o sinal mais recente detectado.',
  },
  {
    icon: '🔁',
    title: 'Sequências automáticas',
    desc: 'Crie cadências de múltiplas etapas que disparam sozinhas conforme o tempo passa, sem perder o timing.',
  },
  {
    icon: '🔌',
    title: 'API + Webhooks',
    desc: 'Integre com seu CRM via API REST com API key. Receba eventos em tempo real por webhook.',
  },
  {
    icon: '🧩',
    title: 'Provedores plugáveis',
    desc: 'Enriquecimento e sinais funcionam com dados de demonstração prontos para uso, e podem ser trocados por provedores reais e compatíveis.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-brand-ink">Pipeline Signal</span>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-brand-ink">
              Entrar
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-light/20 text-brand-dark text-xs font-semibold mb-6">
          AI go-to-market para times B2B
        </span>
        <h1 className="text-5xl font-bold text-brand-ink mb-6 leading-tight">
          Encontre compradores que já estão prontos para comprar
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Descreva seu cliente ideal, deixe a IA montar a lista de leads, acompanhe sinais de
          intenção de compra em tempo real e envie outreach personalizado — tudo em um só lugar.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/register"
            className="px-8 py-3 bg-brand text-white rounded-lg font-semibold hover:bg-brand-dark transition"
          >
            Começar agora
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-ink text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para preencher seu pipeline?</h2>
          <p className="text-gray-300 mb-8">
            Crie sua conta e gere sua primeira lista de leads em menos de um minuto.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-3 bg-brand text-white rounded-lg font-semibold hover:bg-brand-dark transition"
          >
            Começar grátis
          </Link>
        </div>
      </section>

      <footer className="text-center text-xs text-gray-400 py-8">
        Projeto de demonstração — dados de leads, enriquecimento e sinais são gerados
        artificialmente para fins de desenvolvimento local.
      </footer>
    </main>
  );
}
