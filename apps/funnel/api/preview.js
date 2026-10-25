// Painel: renderiza a página que está sendo editada (sem salvar e sem contar visita).

const { send, readJson, handler } = require('../lib/http');
const { isAdmin } = require('../lib/auth');
const { renderPage, sendHtml } = require('../lib/render');
const schema = require('../shared/pageSchema');

module.exports = handler(['POST'], async (req, res) => {
  if (!isAdmin(req)) return send(res, 401, { error: 'Não autorizado' });
  const page = schema.clean(await readJson(req)) || {};
  page.blocks ||= [];
  page.slug ||= 'previa';
  try {
    sendHtml(res, 200, await renderPage(page));
  } catch (err) {
    send(res, 422, { error: err.message.replace(/^Página: /, '') });
  }
});
