// Painel: baixa os leads filtrados em CSV (abre direto no Excel/Google Planilhas).

const { send, handler } = require('../lib/http');
const { parseFilters, searchParams } = require('../lib/filters');
const { isAdmin } = require('../lib/auth');
const { loadConfig } = require('../lib/config');
const store = require('../lib/store');

// Aspas sempre; fórmula no começo vira texto (evita injeção de fórmula na planilha)
const cell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

module.exports = handler(['GET'], async (req, res) => {
  if (!isAdmin(req)) return send(res, 401, { error: 'Não autorizado' });
  const quiz = loadConfig().quiz;
  const { leads } = await store.queryLeads({ ...parseFilters(searchParams(req)), limit: 5000, offset: 0 });
  const label = (q, v) => (q.options.find((o) => o.value === v) || {}).label || v || '';

  const head = ['Data', 'Código', 'Status', 'Etapa', 'Nome', 'Instagram', 'WhatsApp', 'Clicou no WhatsApp',
    ...quiz.questions.map((q) => q.title), 'Profissão (outra)', 'Origem', 'Campanha', 'Tema', 'Anotações'];
  const lines = leads.map((l) => [
    new Date(l.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    l.code, l.status, l.stage, l.nome, l.instagram ? `@${l.instagram}` : '', l.whatsapp ? `+${l.whatsapp}` : '',
    l.whatsappClickedAt ? 'sim' : '',
    ...quiz.questions.map((q) => label(q, l.answers?.[q.id])),
    l.areaOutro, l.utm?.utm_source, l.utm?.utm_campaign, l.utm?.tema, l.notes,
  ]);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${store.dayOf(new Date())}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  // BOM para o Excel reconhecer UTF-8; ponto e vírgula é o separador que o Excel em português espera
  res.end('﻿' + [head, ...lines].map((r) => r.map(cell).join(';')).join('\r\n'));
});
