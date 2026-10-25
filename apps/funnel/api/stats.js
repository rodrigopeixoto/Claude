// Painel: números da visão geral. ?from=YYYY-MM-DD&to=YYYY-MM-DD (padrão: últimos 30 dias).

const { send, handler } = require('../lib/http');
const { parseFilters, searchParams, addDays } = require('../lib/filters');
const { isAdmin } = require('../lib/auth');
const { loadConfig } = require('../lib/config');
const { computeStats } = require('../lib/stats');
const store = require('../lib/store');

module.exports = handler(['GET'], async (req, res) => {
  if (!isAdmin(req)) return send(res, 401, { error: 'Não autorizado' });
  const params = searchParams(req);
  if (!params.get('from')) params.set('from', addDays(store.dayOf(new Date()), -29));
  const f = parseFilters(params);
  const { leads } = await store.queryLeads({ from: f.from, to: f.to, limit: 5000 });
  const visits = await store.listVisits(f.fromDay, f.toDay);
  send(res, 200, { from: f.fromDay, to: f.toDay ? addDays(f.toDay, -1) : null, ...computeStats(leads, visits, loadConfig().quiz) });
});
