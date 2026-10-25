// Painel: páginas de links.
// GET              lista com visitas e cliques do período (?from&to, padrão 30 dias)
// GET ?slug=       página + cliques por link
// POST { slug, name, from? }  cria (vazia ou cópia de outra página)
// PUT ?slug=       salva a página inteira
// DELETE ?slug=    exclui

const { send, readJson, handler } = require('../lib/http');
const { parseFilters, searchParams, addDays } = require('../lib/filters');
const { isAdmin } = require('../lib/auth');
const { renderPage } = require('../lib/render');
const schema = require('../shared/pageSchema');
const store = require('../lib/store');

function period(params) {
  if (!params.get('from')) params.set('from', addDays(store.dayOf(new Date()), -29));
  const f = parseFilters(params);
  return { from: f.fromDay, to: f.toDay };
}

// Limpa, confere slug e valida renderizando (o renderizador recusa link inválido, bloco inexistente etc.)
async function validPage(body, slug) {
  const page = schema.clean(body) || {};
  page.slug = slug;
  page.blocks ||= [];
  try {
    await renderPage(page);
  } catch (err) {
    throw Object.assign(new Error(err.message.replace(/^Página: /, '')), { status: 422 });
  }
  return page;
}

module.exports = handler(['GET', 'POST', 'PUT', 'DELETE'], async (req, res) => {
  if (!isAdmin(req)) return send(res, 401, { error: 'Não autorizado' });
  const params = searchParams(req);
  const slug = params.get('slug');

  if (req.method === 'GET' && !slug) {
    const { from, to } = period(params);
    const totals = await store.pageEventTotals(from, to);
    const pages = (await store.listPages()).map((r) => {
      const mine = totals.filter((t) => t.slug === r.slug);
      const views = mine.filter((t) => t.key === 'view').reduce((s, t) => s + t.count, 0);
      const clicks = mine.filter((t) => t.key !== 'view').reduce((s, t) => s + t.count, 0);
      return { slug: r.slug, name: r.data.name, role: r.data.role || '', accent: r.data.theme?.accent, updatedAt: r.updatedAt, views, clicks };
    });
    return send(res, 200, { pages });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const newSlug = String(body.slug || '').trim();
    if (!schema.SLUG.test(newSlug)) return send(res, 400, { error: 'Endereço só com letras minúsculas, números e hífen (ex.: dra-ana-lima).' });
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) return send(res, 400, { error: 'Informe o nome.' });
    let base = schema.newPage(newSlug, name);
    if (body.from) {
      const src = await store.getPage(String(body.from));
      if (src) base = { ...structuredClone(src.data), slug: newSlug, name };
    }
    const page = await validPage(base, newSlug);
    if (!(await store.savePage(page, { create: true }))) return send(res, 409, { error: 'Já existe uma página com esse endereço.' });
    return send(res, 201, { page });
  }

  if (!slug || !schema.SLUG.test(slug)) return send(res, 400, { error: 'slug inválido' });
  const row = await store.getPage(slug);
  if (!row) return send(res, 404, { error: 'Página não encontrada' });

  if (req.method === 'GET') {
    const { from, to } = period(params);
    const totals = await store.pageEventTotals(from, to, slug);
    const count = (key) => totals.filter((t) => t.key === key).reduce((s, t) => s + t.count, 0);
    const targets = schema.clickTargets(row.data).map((t) => ({ ...t, count: count(t.key) }));
    const views = count('view');
    return send(res, 200, { page: row.data, updatedAt: row.updatedAt, stats: { views, clicks: targets.reduce((s, t) => s + t.count, 0), targets } });
  }

  if (req.method === 'PUT') {
    const page = await validPage(await readJson(req), slug);
    await store.savePage(page);
    return send(res, 200, { page, updatedAt: new Date().toISOString() });
  }

  await store.deletePage(slug);
  send(res, 200, { ok: true });
});
