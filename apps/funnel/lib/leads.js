// Regras de entrada de um lead, sem banco nem HTTP: fácil de testar.

const crypto = require('node:crypto');
const { outcome, invalidAnswers } = require('../shared/qualify');
const phone = require('../shared/phone');

const MIN_ELAPSED_MS = 3000; // ninguém responde quatro perguntas e o contato em menos de 3s
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I: o código é lido em voz alta

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Aceita "@perfil", "perfil" ou o link do Instagram e guarda só o usuário
const cleanInstagram = (s) =>
  str(s, 200).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#\s]/)[0].toLowerCase();

function leadCode(prefix) {
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${prefix}-${out}`;
}

function cleanUtm(utm) {
  const out = {};
  if (!utm || typeof utm !== 'object') return out;
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'tema']) {
    if (utm[k]) out[k] = str(utm[k], 300);
  }
  return out;
}

// Devolve { bot } | { error, fields } | { lead, status }
function buildLead(body, cfg, meta = {}) {
  const quiz = cfg.quiz;

  // honeypot preenchido ou rápido demais: robô. Responde como se fosse um lead frio, sem gravar
  if (str(body.website) || Number(body.elapsedMs) < MIN_ELAPSED_MS) return { bot: true };

  const answers = {};
  for (const q of quiz.questions) answers[q.id] = str(body[q.id], 40);

  const fields = invalidAnswers(quiz, answers);

  // "Outra área" exige o nome da profissão
  const other = quiz.questions.find((q) => q.otherField);
  const areaOutro = str(body.areaOutro, 80);
  if (other && answers[other.id] === other.otherField.value && areaOutro.length < 2) fields.push('area');

  const status = outcome(quiz, answers);
  const lead = {
    id: crypto.randomUUID(),
    code: leadCode(cfg.brand.leadCodePrefix || 'LD'),
    token: crypto.randomBytes(16).toString('hex'),
    status,
    answers,
    areaOutro: areaOutro || null,
    nome: null,
    instagram: null,
    whatsapp: null,
    utm: cleanUtm(body.utm),
    elapsedMs: Math.round(Number(body.elapsedMs)) || null,
    ip: meta.ip || null,
    userAgent: str(meta.userAgent, 300) || null,
    createdAt: (meta.now || new Date()).toISOString(),
  };

  // Só quem se qualifica deixa contato; dos outros guardamos apenas as respostas
  if (status === 'qualified') {
    lead.nome = str(body.nome, 80);
    if (lead.nome.length < 2) fields.push('nome');
    lead.instagram = cleanInstagram(body.instagram);
    if (lead.instagram.length < 2 || !/^[a-z0-9._]+$/.test(lead.instagram)) fields.push('instagram');
    const ph = phone.validate(str(body.ddi, 4), body.whatsapp);
    if (ph.ok) lead.whatsapp = ph.e164;
    else fields.push('whatsapp');
  }

  if (fields.length) return { error: 'Revise as respostas destacadas.', fields };
  return { lead, status };
}

module.exports = { buildLead, cleanInstagram, leadCode, MIN_ELAPSED_MS };
