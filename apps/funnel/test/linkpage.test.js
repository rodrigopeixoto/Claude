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
