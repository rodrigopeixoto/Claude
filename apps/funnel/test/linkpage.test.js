const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = () => import('../linkpage.mjs');
const base = { slug: 'dra-teste', name: 'Dra. Teste', blocks: [] };

test('linkpage: exemplos de pages/ renderizam', async () => {
  const { renderLinkPage } = await load();
  const dir = path.join(__dirname, '..', 'pages');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const page = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const html = renderLinkPage(page, f);
    assert.match(html, /<h1>/, f);
    assert.doesNotMatch(html, /undefined|\[object Object\]/, f);
  }
});

test('linkpage: slug, tipo de bloco e cor são validados', async () => {
  const { renderLinkPage } = await load();
  assert.throws(() => renderLinkPage({ ...base, slug: 'Dra Teste' }, 'x'), /slug/);
  assert.throws(() => renderLinkPage({ ...base, slug: 'admin' }, 'x'), /reservado/);
  assert.throws(() => renderLinkPage({ ...base, blocks: [{ type: 'carrossel' }] }, 'x'), /não existe/);
  assert.throws(() => renderLinkPage({ ...base, theme: { accent: 'red' } }, 'x'), /accent/);
});

test('linkpage: link javascript: é recusado', async () => {
  const { renderLinkPage } = await load();
  const page = { ...base, blocks: [{ type: 'links', items: [{ label: 'x', url: 'javascript:alert(1)' }] }] };
  assert.throws(() => renderLinkPage(page, 'x'), /link inválido/);
});

test('linkpage: texto do cliente é escapado e WhatsApp vira wa.me', async () => {
  const { renderLinkPage } = await load();
  const html = renderLinkPage({
    ...base,
    name: '<script>alert(1)</script>',
    whatsapp: '+55 (11) 99999-9999',
    cta: { label: 'Falar', message: 'Oi & tchau' },
    blocks: [{ type: 'links', items: [{ label: 'Agendar', whatsappMessage: 'Quero agendar' }] }],
  }, 'x');
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /https:\/\/wa\.me\/5511999999999\?text=Oi%20%26%20tchau/);
  assert.match(html, /https:\/\/wa\.me\/5511999999999\?text=Quero%20agendar/);
});

test('pageSchema: página nova e blocos novos já são válidos', async () => {
  const { renderLinkPage } = await load();
  const S = require('../shared/pageSchema');
  const page = S.newPage('nova', 'Nova');
  for (const type of Object.keys(S.BLOCKS)) if (type !== 'video') page.blocks.push(S.newBlock(type));
  assert.match(renderLinkPage(S.clean(page), 'x'), /<h1>Nova/);
  assert.throws(() => renderLinkPage({ ...base, blocks: [{ type: 'links', items: [{ label: 'x' }] }] }, 'x'), /falta o link/);
});

test('pageSchema: clickTargets bate com os data-k do HTML', async () => {
  const { renderLinkPage } = await load();
  const S = require('../shared/pageSchema');
  const page = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pages', 'dra-ana-lima.json'), 'utf8'));
  const html = renderLinkPage(page, 'x');
  const keys = [...new Set([...html.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(S.clickTargets(page).map((t) => t.key).sort(), keys);
});
