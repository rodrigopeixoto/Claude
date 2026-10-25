// Painel: GET ?id= devolve um lead; PATCH ?id= { stage?, notes? } atualiza etapa e anotações.

const { send, readJson, handler } = require('../lib/http');
const { searchParams } = require('../lib/filters');
const { isAdmin } = require('../lib/auth');
const store = require('../lib/store');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = handler(['GET', 'PATCH'], async (req, res) => {
  if (!isAdmin(req)) return send(res, 401, { error: 'Não autorizado' });
  const id = searchParams(req).get('id') || '';
  if (!UUID.test(id)) return send(res, 400, { error: 'id inválido' });

  if (req.method === 'GET') {
    const lead = await store.getLead(id);
    return lead ? send(res, 200, lead) : send(res, 404, { error: 'Lead não encontrado' });
  }

  const body = await readJson(req);
  const patch = {};
  if (body.stage !== undefined) {
    if (!store.STAGES.includes(body.stage)) return send(res, 400, { error: 'Etapa inválida' });
    patch.stage = body.stage;
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') return send(res, 400, { error: 'Anotação inválida' });
    patch.notes = body.notes.slice(0, 5000);
  }
  const lead = await store.updateLead(id, patch);
  lead ? send(res, 200, lead) : send(res, 404, { error: 'Lead não encontrado' });
});
