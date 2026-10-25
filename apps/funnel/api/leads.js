// POST: recebe o quiz e decide o destino. GET (painel): lista os leads com filtros.

const { send, readJson, clientIp, rateLimiter, handler } = require('../lib/http');
const { loadConfig } = require('../lib/config');
const { buildLead } = require('../lib/leads');
const { parseFilters, searchParams } = require('../lib/filters');
const { isAdmin } = require('../lib/auth');
const store = require('../lib/store');

const allow = rateLimiter({ max: 8, windowMs: 10 * 60 * 1000 });

module.exports = handler(['POST', 'GET'], async (req, res) => {
  if (req.method === 'GET') {
    if (!isAdmin(req)) return send(res, 401, { error: 'Não autorizado' });
    return send(res, 200, await store.queryLeads(parseFilters(searchParams(req))));
  }

  const ip = clientIp(req);
  if (!allow(ip)) return send(res, 429, { error: 'Muitas tentativas. Tente de novo em alguns minutos.' });

  const body = await readJson(req);
  const result = buildLead(body, loadConfig(), { ip, userAgent: req.headers['user-agent'] });

  if (result.bot) return send(res, 200, { status: 'material' });
  if (result.error) return send(res, 422, { error: result.error, fields: result.fields });

  const { lead } = result;
  await store.saveLead(lead);
  if (lead.status !== 'qualified') return send(res, 200, { status: lead.status });
  send(res, 200, { status: lead.status, leadId: lead.id, token: lead.token, code: lead.code });
});
