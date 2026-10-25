// Conta uma visita da landing por tema (teste A/B). O navegador manda uma vez por sessão.

const { send, readJson, clientIp, rateLimiter, handler } = require('../lib/http');
const store = require('../lib/store');

const allow = rateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });

module.exports = handler(['POST'], async (req, res) => {
  const { tema } = await readJson(req);
  if (tema !== 'claro' && tema !== 'escuro') return send(res, 400, { error: 'tema inválido' });
  if (allow(clientIp(req))) await store.addVisit(tema);
  send(res, 200, { ok: true });
});
