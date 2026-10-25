// Página de links pública: /<slug> chega aqui (rewrite na Vercel, fallback no dev-server).
// ?embed=1 (vitrine da landing) não conta visita.

const { handler } = require('../lib/http');
const { searchParams } = require('../lib/filters');
const { renderPage, sendHtml } = require('../lib/render');
const { SLUG } = require('../shared/pageSchema');
const store = require('../lib/store');

const notFound = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página não encontrada</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;color:#555"><p>Página não encontrada.</p></body>';

module.exports = handler(['GET'], async (req, res) => {
  const params = searchParams(req);
  const slug = params.get('slug') || '';
  const row = SLUG.test(slug) ? await store.getPage(slug) : null;
  if (!row) return sendHtml(res, 404, notFound);
  sendHtml(res, 200, await renderPage(row.data, { track: params.get('embed') !== '1' }));
});
