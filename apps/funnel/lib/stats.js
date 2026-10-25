// Números da visão geral, calculados a partir dos leads e visitas do período.

const { dayOf } = require('./store');

const rate = (a, b) => (b ? a / b : null);

function countBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function computeStats(leads, visits, quiz) {
  const qualified = leads.filter((l) => l.status === 'qualified');
  const visitTotal = visits.reduce((s, v) => s + v.count, 0);
  const clicks = qualified.filter((l) => l.whatsappClickedAt).length;

  const status = { qualified: 0, downsell: 0, material: 0 };
  for (const l of leads) status[l.status] = (status[l.status] || 0) + 1;

  const stages = Object.fromEntries(countBy(qualified, (l) => l.stage || 'novo'));

  // Origem: utm_source; sem UTM conta como "direto"
  const sources = new Map();
  for (const l of leads) {
    const s = (l.utm && l.utm.utm_source) || 'direto';
    const row = sources.get(s) || { source: s, leads: 0, qualified: 0 };
    row.leads++;
    if (l.status === 'qualified') row.qualified++;
    sources.set(s, row);
  }

  // Teste A/B: visitas contadas pelo beacon, leads pelo tema que veio junto
  const ab = ['escuro', 'claro'].map((tema) => {
    const v = visits.filter((x) => x.tema === tema).reduce((s, x) => s + x.count, 0);
    const ls = leads.filter((l) => l.utm && l.utm.tema === tema);
    const q = ls.filter((l) => l.status === 'qualified').length;
    return { tema, visits: v, leads: ls.length, qualified: q, conversion: rate(q, v) };
  });

  const daily = new Map();
  for (const l of leads) {
    const d = dayOf(new Date(l.createdAt));
    const row = daily.get(d) || { day: d, leads: 0, qualified: 0 };
    row.leads++;
    if (l.status === 'qualified') row.qualified++;
    daily.set(d, row);
  }
  for (const v of visits) {
    const row = daily.get(v.day) || { day: v.day, leads: 0, qualified: 0 };
    row.visits = (row.visits || 0) + v.count;
    daily.set(v.day, row);
  }

  // Distribuição de cada pergunta, com o texto da opção
  const answers = quiz.questions.map((q) => {
    const counts = countBy(leads, (l) => l.answers && l.answers[q.id]);
    return {
      id: q.id,
      title: q.title,
      options: q.options.map((o) => ({ value: o.value, label: o.label, count: counts.get(o.value) || 0 })),
    };
  });

  return {
    totals: {
      visits: visitTotal,
      leads: leads.length,
      qualified: qualified.length,
      whatsappClicks: clicks,
      closed: stages.fechado || 0,
      quizRate: rate(leads.length, visitTotal),
      qualifiedRate: rate(qualified.length, leads.length),
      clickRate: rate(clicks, qualified.length),
    },
    status,
    stages,
    sources: [...sources.values()].sort((a, b) => b.leads - a.leads),
    ab,
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    answers,
  };
}

module.exports = { computeStats };
