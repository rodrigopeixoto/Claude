const test = require('node:test');
const assert = require('node:assert/strict');
const { outcome, invalidAnswers } = require('../shared/qualify');
const phone = require('../shared/phone');
const { buildLead, cleanInstagram, leadCode } = require('../lib/leads');
const { loadConfig } = require('../lib/config');

const cfg = loadConfig({});
const good = { segmento: 'saude', particular: 'sim', fotos: 'sim', investimento: 'basico' };
const contact = { nome: 'Ana Lima', instagram: '@ana.lima', ddi: '55', whatsapp: '(11) 98765-4321' };
const human = { elapsedMs: 15000 };

test('qualify: respostas boas qualificam', () => {
  assert.equal(outcome(cfg.quiz, good), 'qualified');
});

test('qualify: sem orçamento vai para downsell', () => {
  assert.equal(outcome(cfg.quiz, { ...good, investimento: 'pesquisando' }), 'downsell');
});

test('qualify: material vence downsell', () => {
  assert.equal(outcome(cfg.quiz, { ...good, particular: 'nao', investimento: 'pesquisando' }), 'material');
});

test('qualify: resposta fora das opções é inválida', () => {
  assert.deepEqual(invalidAnswers(cfg.quiz, { ...good, fotos: 'talvez' }), ['fotos']);
});

test('phone: celular brasileiro válido vira E.164', () => {
  assert.deepEqual(phone.validate('55', '(11) 98765-4321'), { ok: true, e164: '5511987654321' });
});

test('phone: fixo brasileiro e dígitos repetidos são recusados', () => {
  assert.equal(phone.validate('55', '(11) 3456-7890').ok, false);
  assert.equal(phone.validate('55', '11111111111').ok, false);
  assert.equal(phone.validate('999', '123').ok, false);
});

test('phone: máscara brasileira', () => {
  assert.equal(phone.format('55', '11987654321'), '(11) 98765-4321');
});

test('instagram: aceita @, link ou usuário puro', () => {
  assert.equal(cleanInstagram('@Ana.Lima'), 'ana.lima');
  assert.equal(cleanInstagram('https://www.instagram.com/ana.lima/?hl=pt'), 'ana.lima');
});

test('leadCode: prefixo e 6 caracteres sem ambíguos', () => {
  assert.match(leadCode('SM'), /^SM-[A-HJ-NP-Z2-9]{6}$/);
});

test('buildLead: qualificado com contato gera lead completo', () => {
  const r = buildLead({ ...good, ...contact, ...human, utm: { utm_source: 'ig', junk: 'x' } }, cfg);
  assert.equal(r.status, 'qualified');
  assert.equal(r.lead.whatsapp, '5511987654321');
  assert.equal(r.lead.instagram, 'ana.lima');
  assert.deepEqual(r.lead.utm, { utm_source: 'ig' });
  assert.match(r.lead.token, /^[0-9a-f]{32}$/);
});

test('buildLead: qualificado sem contato válido devolve os campos', () => {
  const r = buildLead({ ...good, ...human, nome: 'A', instagram: '', whatsapp: '123', ddi: '55' }, cfg);
  assert.deepEqual(r.fields.sort(), ['instagram', 'nome', 'whatsapp']);
});

test('buildLead: não qualificado não guarda contato', () => {
  const r = buildLead({ ...good, investimento: 'pesquisando', ...contact, ...human }, cfg);
  assert.equal(r.status, 'downsell');
  assert.equal(r.lead.whatsapp, null);
  assert.equal(r.lead.nome, null);
});

test('buildLead: "outra área" exige a profissão', () => {
  const r = buildLead({ ...good, segmento: 'outro', ...contact, ...human }, cfg);
  assert.deepEqual(r.fields, ['area']);
  assert.ok(buildLead({ ...good, segmento: 'outro', areaOutro: 'Fotógrafa', ...contact, ...human }, cfg).lead);
});

test('buildLead: honeypot ou envio rápido demais é robô', () => {
  assert.equal(buildLead({ ...good, ...contact, ...human, website: 'spam.com' }, cfg).bot, true);
  assert.equal(buildLead({ ...good, ...contact, elapsedMs: 500 }, cfg).bot, true);
});
