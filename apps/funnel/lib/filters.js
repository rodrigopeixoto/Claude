// Lê e valida os filtros do painel a partir da query string.

const { STAGES, STATUSES } = require('./store');

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Dia do painel (horário de Brasília) → instante ISO
const dayStart = (day) => new Date(`${day}T00:00:00-03:00`).toISOString();

function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function searchParams(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

// from/to chegam como dias inclusivos (YYYY-MM-DD); internamente "to" vira exclusivo
function parseFilters(params) {
  const f = {};
  const status = params.get('status');
  if (STATUSES.includes(status)) f.status = status;
  const stage = params.get('stage');
  if (STAGES.includes(stage)) f.stage = stage;
  const q = (params.get('q') || '').trim().slice(0, 80);
  if (q) f.q = q;
  const from = params.get('from');
  const to = params.get('to');
  if (DAY.test(from || '')) { f.fromDay = from; f.from = dayStart(from); }
  if (DAY.test(to || '')) { f.toDay = addDays(to, 1); f.to = dayStart(f.toDay); }
  if (params.get('limit')) f.limit = Number(params.get('limit'));
  if (params.get('offset')) f.offset = Number(params.get('offset'));
  return f;
}

module.exports = { parseFilters, searchParams, addDays, dayStart };
