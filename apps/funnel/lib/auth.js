// Login do painel: uma senha (ADMIN_PASSWORD) e um cookie de sessão assinado com HMAC.
// A chave de assinatura é SESSION_SECRET ou, sem ela, derivada da senha: trocar a senha derruba todas as sessões.

const crypto = require('node:crypto');

const COOKIE = 'f_session';
const MAX_AGE_S = 7 * 24 * 3600;

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

function secret(env = process.env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.ADMIN_PASSWORD) return sha256(`funnel-session:${env.ADMIN_PASSWORD}`).toString('hex');
  return null;
}

// Compara pelo hash: tempo constante mesmo com tamanhos diferentes
function checkPassword(given, env = process.env) {
  if (!env.ADMIN_PASSWORD || typeof given !== 'string' || !given) return false;
  return crypto.timingSafeEqual(sha256(given), sha256(env.ADMIN_PASSWORD));
}

const sign = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64url');

function createToken(now = Date.now(), env = process.env) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + MAX_AGE_S })).toString('base64url');
  return `${payload}.${sign(payload, secret(env))}`;
}

function verifyToken(token, now = Date.now(), env = process.env) {
  const key = secret(env);
  if (!key || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload, key));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp * 1000 > now;
  } catch {
    return false;
  }
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Secure só fora de localhost: no servidor local (http) o navegador recusaria o cookie
function cookieHeader(req, value, maxAge) {
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '');
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${local ? '' : '; Secure'}`;
}

const loginCookie = (req) => cookieHeader(req, createToken(), MAX_AGE_S);
const logoutCookie = (req) => cookieHeader(req, '', 0);

// Sessão do painel ou, para integrações, Authorization: Bearer $ADMIN_KEY
function isAdmin(req, env = process.env) {
  if (verifyToken(readCookie(req, COOKIE), Date.now(), env)) return true;
  const key = env.ADMIN_KEY;
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return !!key && !!given && crypto.timingSafeEqual(sha256(given), sha256(key));
}

const configured = (env = process.env) => !!env.ADMIN_PASSWORD;

module.exports = { checkPassword, createToken, verifyToken, readCookie, loginCookie, logoutCookie, isAdmin, configured };
