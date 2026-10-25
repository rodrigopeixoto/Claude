// Dados de demonstração: leads e visitas fake para ver landing e painel funcionando sem banco.
// Sempre os mesmos para o mesmo dia (semente fixa), então instâncias diferentes da Vercel mostram os mesmos números.

const { outcome } = require('../shared/qualify');

// separados para o "Dr." / "Dra." combinar com o nome
const FIRST_F = ['Ana', 'Carla', 'Eduarda', 'Gabriela', 'Isabela', 'Larissa', 'Natália', 'Paula', 'Sofia', 'Vanessa', 'Mariana', 'Camila', 'Beatriz', 'Renata', 'Juliana'];
const FIRST_M = ['Bruno', 'Diego', 'Felipe', 'Henrique', 'João', 'Marcelo', 'Otávio', 'Rafael', 'Thiago', 'Lucas', 'Pedro', 'Gustavo', 'André'];
const LAST = ['Lima', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Ribeiro', 'Martins', 'Rocha', 'Barbosa', 'Moreira', 'Teixeira', 'Mendes', 'Freitas'];
const TITLED = ['saude', 'direito']; // áreas em que o título aparece no nome
const OTHER_JOBS = ['Fotógrafa', 'Contador', 'Fisioterapeuta', 'Personal trainer', 'Tatuador', 'Corretora de imóveis'];
const DDD = ['11', '21', '31', '41', '48', '51', '61', '71', '81', '15', '19'];
const NOTES = ['Pediu exemplos de páginas da área dele.', 'Mandou proposta, aguardando retorno.', 'Quer começar semana que vem.', 'Achou caro, pensar em parcelamento.', 'Fechou o plano completo.', ''];
// [valor, peso]
const SOURCES = [['instagram', 55], ['facebook', 20], ['google', 10], [null, 15]];
const CAMPAIGNS = ['bio-24h', 'antes-depois', 'remarketing'];
const STAGES = [['novo', 30], ['contatado', 30], ['negociando', 15], ['fechado', 15], ['perdido', 10]];
// Peso de cada opção do quiz por pergunta, na ordem do config; perguntas novas usam peso igual
const ANSWER_WEIGHTS = { segmento: [35, 20, 15, 20, 10], particular: [55, 30, 15], fotos: [45, 40, 15], investimento: [45, 15, 40] };

// PRNG pequeno e determinístico (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY_MS = 864e5;

function generateDemo(cfg, { now = new Date(), days = 60, seed = 20261025 } = {}) {
  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const weighted = (pairs) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [v, w] of pairs) if ((r -= w) < 0) return v;
    return pairs[pairs.length - 1][0];
  };
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(rand() * 4)]}${hex(3)}-${hex(12)}`;
  const prefix = cfg.brand.leadCodePrefix || 'LD';

  // Âncora no início do dia (Brasília) para os dados não mudarem a cada requisição
  const today = new Date(`${now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}T00:00:00-03:00`);
  const leads = [];
  const visits = [];

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = new Date(today.getTime() - d * DAY_MS);
    const day = dayStart.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    // crescimento leve ao longo do período + ruído; fim de semana mais fraco
    const weekend = [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
    const base = (2 + ((days - d) / days) * 5) * (weekend ? 0.6 : 1);
    const count = Math.max(0, Math.round(base + (rand() - 0.5) * 4));
    const temaCount = { escuro: 0, claro: 0 };

    for (let i = 0; i < count; i++) {
      const tema = rand() < 0.5 ? 'escuro' : 'claro';
      const answers = {};
      for (const q of cfg.quiz.questions) {
        const w = ANSWER_WEIGHTS[q.id];
        answers[q.id] = weighted(q.options.map((o, k) => [o.value, (w && w[k]) || 10]));
      }
      // o tema claro converte um pouco melhor nos dados de exemplo, para o A/B ter vencedor
      if (tema === 'claro' && answers.investimento === 'pesquisando' && rand() < 0.2) answers.investimento = 'basico';
      const status = outcome(cfg.quiz, answers);
      const createdAt = new Date(dayStart.getTime() + (8 + rand() * 14) * 3600e3);
      if (createdAt > now) continue;
      temaCount[tema]++;

      const source = weighted(SOURCES);
      const otherQ = cfg.quiz.questions.find((q) => q.otherField);
      const lead = {
        id: uuid(),
        code: `${prefix}-${Array.from({ length: 6 }, () => pick(CODE_ALPHABET)).join('')}`,
        token: hex(32),
        status,
        stage: 'novo',
        notes: '',
        answers,
        areaOutro: otherQ && answers[otherQ.id] === otherQ.otherField.value ? pick(OTHER_JOBS) : null,
        nome: null,
        instagram: null,
        whatsapp: null,
        utm: { ...(source ? { utm_source: source, utm_medium: 'social', utm_campaign: pick(CAMPAIGNS) } : {}), tema },
        elapsedMs: Math.round(20000 + rand() * 70000),
        whatsappClickedAt: null,
        createdAt: createdAt.toISOString(),
        updatedAt: null,
        demo: true,
      };
      if (status === 'qualified') {
        const female = rand() < 0.55;
        const first = pick(female ? FIRST_F : FIRST_M), last = pick(LAST);
        const title = TITLED.includes(answers.segmento) && rand() < 0.4 ? (female ? 'Dra. ' : 'Dr. ') : '';
        lead.nome = `${title}${first} ${last}`;
        lead.instagram = `${first}.${last}${rand() < 0.3 ? Math.floor(rand() * 90 + 10) : ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        lead.whatsapp = `55${pick(DDD)}9${String(Math.floor(rand() * 1e8)).padStart(8, '0')}`;
        if (rand() < 0.72) lead.whatsappClickedAt = new Date(createdAt.getTime() + 60e3 + rand() * 300e3).toISOString();
        // leads recentes ainda estão no começo do atendimento
        lead.stage = d < 2 ? 'novo' : weighted(STAGES);
        if (lead.stage !== 'novo') {
          lead.notes = pick(NOTES);
          lead.updatedAt = new Date(Math.min(now.getTime(), createdAt.getTime() + rand() * 2 * DAY_MS)).toISOString();
        }
      }
      leads.push(lead);
    }

    // cerca de 1 em 4 visitantes responde o quiz
    for (const tema of ['escuro', 'claro']) {
      const v = Math.round(temaCount[tema] * (3 + rand() * 2) + rand() * 6);
      if (v) visits.push({ day, tema, count: v });
    }
  }
  return { leads, visits };
}

module.exports = { generateDemo };
