// Utilidades HTTP que funcionam igual nas funções da Vercel e no servidor local (dev-server.js).

const MAX_BODY = 32 * 1024;

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// A Vercel já entrega req.body pronto; no servidor local o corpo vem do stream
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error('Corpo grande demais'), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.socket?.remoteAddress || '').trim();
}

// Limite por IP em memória. Na Vercel cada instância tem a sua memória, então é um freio, não uma garantia
function rateLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) hits.clear();
    return arr.length <= max;
  };
}

// Envolve um handler: só aceita os métodos listados e transforma erros em JSON
function handler(methods, fn) {
  return async (req, res) => {
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return send(res, 405, { error: 'Método não permitido' });
    }
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof SyntaxError) return send(res, 400, { error: 'JSON inválido' });
      if (err.status) return send(res, err.status, { error: err.message });
      console.error(err);
      send(res, 500, { error: 'Erro inesperado' });
    }
  };
}

module.exports = { send, readJson, clientIp, rateLimiter, handler };
