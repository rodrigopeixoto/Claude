const test = require('node:test');
const assert = require('node:assert/strict');
const { generateDemo } = require('../lib/demo');
const { loadConfig } = require('../lib/config');
const { outcome } = require('../shared/qualify');
const phone = require('../shared/phone');
const store = require('../lib/store');

const cfg = loadConfig({});
const now = new Date('2026-10-25T15:00:00Z');

test('demo: mesmos dados para o mesmo dia', () => {
  const a = generateDemo(cfg, { now });
  const b = generateDemo(cfg, { now: new Date('2026-10-25T20:00:00Z') });
  assert.deepEqual(a.leads.slice(0, 20).map((l) => l.code), b.leads.slice(0, 20).map((l) => l.code));
});

test('demo: leads coerentes com a regra e o config', () => {
  const { leads, visits } = generateDemo(cfg, { now });
  assert.ok(leads.length > 150, `poucos leads: ${leads.length}`);
  assert.ok(visits.length > 0);
  const statuses = new Set(leads.map((l) => l.status));
  assert.deepEqual([...statuses].sort(), ['downsell', 'material', 'qualified']);
  for (const l of leads) {
    assert.equal(l.status, outcome(cfg.quiz, l.answers));
    assert.ok(new Date(l.createdAt) <= now);
    if (l.status === 'qualified') {
      assert.ok(l.nome && l.instagram, 'qualificado sem contato');
      assert.ok(phone.validate('55', l.whatsapp.slice(2)).ok, `WhatsApp inválido ${l.whatsapp}`);
      assert.match(l.instagram, /^[a-z0-9._]+$/);
    } else {
      assert.equal(l.whatsapp, null);
    }
  }
  // visitas sempre maiores que respostas do mesmo dia
  const byDay = {};
  for (const l of leads) { const d = store.dayOf(new Date(l.createdAt)); byDay[d] = (byDay[d] || 0) + 1; }
  for (const [d, n] of Object.entries(byDay)) {
    const v = visits.filter((x) => x.day === d).reduce((s, x) => s + x.count, 0);
    assert.ok(v >= n, `${d}: ${v} visitas para ${n} respostas`);
  }
});

test('store em memória: salva, filtra, atualiza e conta visita', async (t) => {
  delete process.env.DATABASE_URL;
  store.resetMemory({ leads: [], visits: [] });
  t.after(() => store.resetMemory());
  assert.equal(store.isDemo(), true);
  await store.saveLead({ id: 'a', code: 'SM-AAA', token: 't', status: 'qualified', answers: {}, nome: 'Ana', createdAt: '2026-10-20T12:00:00Z', utm: {} });
  await store.saveLead({ id: 'b', code: 'SM-BBB', token: 't', status: 'downsell', answers: {}, createdAt: '2026-10-21T12:00:00Z', utm: {} });
  assert.equal((await store.queryLeads({})).total, 2);
  assert.equal((await store.queryLeads({ q: 'ana' })).leads[0].id, 'a');
  assert.equal((await store.queryLeads({})).leads[0].id, 'b', 'mais recente primeiro');
  assert.equal((await store.queryLeads({})).leads[0].token, undefined, 'token não sai');
  assert.equal(await store.markWhatsapp('a', 'errado'), false);
  assert.equal(await store.markWhatsapp('a', 't'), true);
  assert.equal((await store.updateLead('a', { stage: 'fechado' })).stage, 'fechado');
  await store.addVisit('claro', now);
  await store.addVisit('claro', now);
  assert.deepEqual(await store.listVisits('2026-10-25', '2026-10-26'), [{ day: '2026-10-25', tema: 'claro', count: 2 }]);
});
