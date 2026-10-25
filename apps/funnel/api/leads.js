// POST: recebe o quiz e decide o destino. GET (com ADMIN_KEY): lista os leads.

const crypto = require('node:crypto');
const { send, readJson, clientIp, rateLimiter, handler } = require('../lib/http');
const { loadConfig } = require('../lib/config');
const { buildLead } = require('../lib/leads');
const store = require('../lib/store');

const allow = rateLimiter({ max: 8, windowMs: 10 * 60 * 1000 });

function authorized(req) {
  const key = process.env.ADMIN_KEY;
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!key || !given) return false;
  const a = Buffer.from(key), b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = handler(['POST', 'GET'], async (req, res) => {
  if (req.method === 'GET') {
    if (!authorized(req)) return send(res, 401, { error: 'Não autorizado' });
    return send(res, 200, { leads: await store.listLeads() });
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
