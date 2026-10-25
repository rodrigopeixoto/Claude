const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../lib/auth');
const { computeStats } = require('../lib/stats');
const { parseFilters } = require('../lib/filters');
const { loadConfig } = require('../lib/config');

const env = { ADMIN_PASSWORD: 'segredo-forte' };
const reqWith = (headers) => ({ headers });

test('auth: senha certa passa, errada e vazia não', () => {
  assert.equal(auth.checkPassword('segredo-forte', env), true);
  assert.equal(auth.checkPassword('segredo', env), false);
  assert.equal(auth.checkPassword('', env), false);
  assert.equal(auth.checkPassword('qualquer', {}), false);
});

test('auth: token assinado vale até expirar', () => {
  const now = Date.now();
  const t = auth.createToken(now, env);
  assert.equal(auth.verifyToken(t, now, env), true);
  assert.equal(auth.verifyToken(t, now + 8 * 24 * 3600 * 1000, env), false);
});

test('auth: token adulterado ou de outra senha é recusado', () => {
  const t = auth.createToken(Date.now(), env);
  const [payload, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url');
  assert.equal(auth.verifyToken(`${forged}.${sig}`, Date.now(), env), false);
  assert.equal(auth.verifyToken(`${payload}.${sig}`, Date.now(), { ADMIN_PASSWORD: 'outra' }), false);
  assert.equal(auth.verifyToken('lixo', Date.now(), env), false);
});

test('auth: isAdmin por cookie ou Bearer', () => {
  const t = auth.createToken(Date.now(), env);
  assert.equal(auth.isAdmin(reqWith({ cookie: `x=1; f_session=${t}` }), env), true);
  assert.equal(auth.isAdmin(reqWith({}), env), false);
  assert.equal(auth.isAdmin(reqWith({ authorization: 'Bearer k1' }), { ...env, ADMIN_KEY: 'k1' }), true);
  assert.equal(auth.isAdmin(reqWith({ authorization: 'Bearer k2' }), { ...env, ADMIN_KEY: 'k1' }), false);
});

test('auth: cookie Secure fora de localhost', (t) => {
  process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  t.after(() => delete process.env.ADMIN_PASSWORD);
  assert.match(auth.loginCookie(reqWith({ host: 'site.com' })), /HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/);
  assert.doesNotMatch(auth.loginCookie(reqWith({ host: 'localhost:3100' })), /Secure/);
});

test('filters: dias viram intervalo em Brasília, valores fora da lista somem', () => {
  const f = parseFilters(new URLSearchParams('from=2026-10-01&to=2026-10-31&status=xxx&stage=fechado&q=ana'));
  assert.equal(f.from, '2026-10-01T03:00:00.000Z');
  assert.equal(f.to, '2026-11-01T03:00:00.000Z');
  assert.equal(f.toDay, '2026-11-01');
  assert.equal(f.status, undefined);
  assert.equal(f.stage, 'fechado');
  assert.equal(f.q, 'ana');
});

test('stats: totais, origem, A/B e respostas', () => {
  const quiz = loadConfig({}).quiz;
  const base = { segmento: 'saude', particular: 'sim', fotos: 'sim', investimento: 'basico' };
  const leads = [
    { status: 'qualified', stage: 'fechado', answers: base, utm: { utm_source: 'ig', tema: 'escuro' }, whatsappClickedAt: '2026-10-02T12:00:00Z', createdAt: '2026-10-02T12:00:00Z' },
    { status: 'qualified', stage: 'novo', answers: base, utm: { tema: 'claro' }, createdAt: '2026-10-02T13:00:00Z' },
    { status: 'downsell', answers: { ...base, investimento: 'pesquisando' }, utm: { utm_source: 'ig', tema: 'escuro' }, createdAt: '2026-10-03T13:00:00Z' },
  ];
  const visits = [{ day: '2026-10-02', tema: 'escuro', count: 10 }, { day: '2026-10-02', tema: 'claro', count: 10 }];
  const s = computeStats(leads, visits, quiz);
  assert.equal(s.totals.visits, 20);
  assert.equal(s.totals.leads, 3);
  assert.equal(s.totals.qualified, 2);
  assert.equal(s.totals.whatsappClicks, 1);
  assert.equal(s.totals.closed, 1);
  assert.equal(s.totals.clickRate, 0.5);
  assert.deepEqual(s.sources[0], { source: 'ig', leads: 2, qualified: 1 });
  assert.deepEqual(s.ab.map((r) => [r.tema, r.visits, r.qualified, r.conversion]), [['escuro', 10, 1, 0.1], ['claro', 10, 1, 0.1]]);
  assert.equal(s.daily.find((d) => d.day === '2026-10-02').visits, 20);
  const inv = s.answers.find((a) => a.id === 'investimento');
  assert.equal(inv.options.find((o) => o.value === 'pesquisando').count, 1);
});
