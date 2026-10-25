// GET: estado do login. POST { password }: entra. DELETE: sai.

const { send, readJson, clientIp, rateLimiter, handler } = require('../lib/http');
const auth = require('../lib/auth');
const { isDemo } = require('../lib/store');

const allow = rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

module.exports = handler(['GET', 'POST', 'DELETE'], async (req, res) => {
  if (req.method === 'GET') {
    return send(res, 200, { configured: auth.configured(), authenticated: auth.isAdmin(req), demo: isDemo() });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', auth.logoutCookie(req));
    return send(res, 200, { ok: true });
  }
  if (!auth.configured()) return send(res, 503, { error: 'Defina ADMIN_PASSWORD nas variáveis de ambiente.' });
  if (!allow(clientIp(req))) return send(res, 429, { error: 'Muitas tentativas. Espere 15 minutos.' });
  const { password } = await readJson(req);
  if (!auth.checkPassword(password)) return send(res, 401, { error: 'Senha incorreta.' });
  res.setHeader('Set-Cookie', auth.loginCookie(req));
  send(res, 200, { ok: true });
});
