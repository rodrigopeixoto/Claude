// Conta visita ("view") ou clique (chave do link) de uma página de links.

const { send, readJson, clientIp, rateLimiter, handler } = require('../lib/http');
const { SLUG } = require('../shared/pageSchema');
const store = require('../lib/store');

const KEY = /^(view|cta|s-[a-z]+|b\d{1,2}(-\d{1,3})?)$/;
const allow = rateLimiter({ max: 120, windowMs: 60 * 60 * 1000 });

module.exports = handler(['POST'], async (req, res) => {
  const { slug, key } = await readJson(req);
  if (typeof slug !== 'string' || !SLUG.test(slug) || typeof key !== 'string' || !KEY.test(key)) return send(res, 400, { error: 'inválido' });
  if (allow(clientIp(req)) && (await store.getPage(slug))) await store.addPageEvent(slug, key);
  send(res, 200, { ok: true });
});
