// Ponte para o renderizador (ESM) a partir das funções CommonJS.

let mod;
async function renderPage(page, opts) {
  mod ||= await import('../linkpage.mjs');
  return mod.renderLinkPage(page, 'Página', opts);
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
}

module.exports = { renderPage, sendHtml };
