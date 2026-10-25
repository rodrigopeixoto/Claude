// Registra que o lead qualificado clicou para abrir o WhatsApp.

const { send, readJson, handler } = require('../lib/http');
const store = require('../lib/store');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = handler(['POST'], async (req, res) => {
  const { leadId, token } = await readJson(req);
  // id fora do formato UUID derrubaria a consulta no Postgres
  if (typeof leadId !== 'string' || !UUID.test(leadId) || typeof token !== 'string') return send(res, 400, { error: 'leadId e token são obrigatórios' });
  const ok = await store.markWhatsapp(leadId, token);
  send(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Lead não encontrado' });
});
