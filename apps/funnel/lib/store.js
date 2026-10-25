// Onde os dados ficam. Com DATABASE_URL usa Postgres; sem ela grava em .data/*.json
// (só para desenvolvimento: na Vercel o disco é temporário).

const fs = require('node:fs/promises');
const path = require('node:path');

const DIR = process.env.FUNNEL_DATA_DIR || path.join(__dirname, '..', '.data');
const LEADS_FILE = path.join(DIR, 'leads.json');
const VISITS_FILE = path.join(DIR, 'visits.json');

const STAGES = ['novo', 'contatado', 'negociando', 'fechado', 'perdido'];
const STATUSES = ['qualified', 'downsell', 'material'];

let pool;
function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

const COLUMNS = `id, code, status, stage, notes, answers, area_outro AS "areaOutro", nome, instagram, whatsapp, utm,
  elapsed_ms AS "elapsedMs", whatsapp_clicked_at AS "whatsappClickedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;

// O arquivo local guarda o lead inteiro; para fora sai sem token, IP e user agent
const publicLead = ({ token, ip, userAgent, ...rest }) => ({ stage: 'novo', notes: '', updatedAt: null, whatsappClickedAt: null, ...rest });

async function saveLead(l) {
  const p = db();
  if (!p) {
    const rows = await readJson(LEADS_FILE, []);
    rows.push({ stage: 'novo', notes: '', ...l });
    return writeJson(LEADS_FILE, rows);
  }
  await p.query(
    `INSERT INTO leads (id, code, token, status, answers, area_outro, nome, instagram, whatsapp, utm, elapsed_ms, ip, user_agent, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [l.id, l.code, l.token, l.status, l.answers, l.areaOutro, l.nome, l.instagram, l.whatsapp, l.utm, l.elapsedMs, l.ip, l.userAgent, l.createdAt],
  );
}

// Marca o clique no WhatsApp. Devolve false se id/token não batem
async function markWhatsapp(id, token, now = new Date()) {
  const p = db();
  if (!p) {
    const rows = await readJson(LEADS_FILE, []);
    const row = rows.find((r) => r.id === id && r.token === token);
    if (!row) return false;
    row.whatsappClickedAt ||= now.toISOString();
    await writeJson(LEADS_FILE, rows);
    return true;
  }
  const r = await p.query(
    'UPDATE leads SET whatsapp_clicked_at = COALESCE(whatsapp_clicked_at, $3) WHERE id = $1 AND token = $2',
    [id, token, now],
  );
  return r.rowCount > 0;
}

// Filtros do painel: status, stage, q (nome, @, WhatsApp ou código), from/to (ISO), limit/offset
function matches(l, f) {
  if (f.status && l.status !== f.status) return false;
  if (f.stage && (l.stage || 'novo') !== f.stage) return false;
  if (f.from && l.createdAt < f.from) return false;
  if (f.to && l.createdAt >= f.to) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![l.nome, l.instagram, l.whatsapp, l.code, l.areaOutro].some((v) => v && String(v).toLowerCase().includes(q))) return false;
  }
  return true;
}

async function queryLeads(f = {}) {
  const limit = Math.min(Math.max(Number(f.limit) || 50, 1), 5000);
  const offset = Math.max(Number(f.offset) || 0, 0);
  const p = db();
  if (!p) {
    const rows = (await readJson(LEADS_FILE, [])).filter((l) => matches(l, f)).reverse();
    return { total: rows.length, leads: rows.slice(offset, offset + limit).map(publicLead) };
  }
  const where = [], args = [];
  const add = (sql, v) => { args.push(v); where.push(sql.replace('?', `$${args.length}`)); };
  if (f.status) add('status = ?', f.status);
  if (f.stage) add('stage = ?', f.stage);
  if (f.from) add('created_at >= ?', f.from);
  if (f.to) add('created_at < ?', f.to);
  if (f.q) {
    args.push(`%${f.q.replace(/[%_\\]/g, '\\$&')}%`);
    const n = `$${args.length}`;
    where.push(`(nome ILIKE ${n} OR instagram ILIKE ${n} OR whatsapp ILIKE ${n} OR code ILIKE ${n} OR area_outro ILIKE ${n})`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await p.query(`SELECT count(*)::int AS n FROM leads ${w}`, args);
  const rows = await p.query(`SELECT ${COLUMNS} FROM leads ${w} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, args);
  return { total: total.rows[0].n, leads: rows.rows };
}

async function getLead(id) {
  const p = db();
  if (!p) {
    const row = (await readJson(LEADS_FILE, [])).find((r) => r.id === id);
    return row ? publicLead(row) : null;
  }
  const r = await p.query(`SELECT ${COLUMNS} FROM leads WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

// Só etapa e anotações mudam pelo painel
async function updateLead(id, { stage, notes }, now = new Date()) {
  const p = db();
  if (!p) {
    const rows = await readJson(LEADS_FILE, []);
    const row = rows.find((r) => r.id === id);
    if (!row) return null;
    if (stage !== undefined) row.stage = stage;
    if (notes !== undefined) row.notes = notes;
    row.updatedAt = now.toISOString();
    await writeJson(LEADS_FILE, rows);
    return publicLead(row);
  }
  const r = await p.query(
    `UPDATE leads SET stage = COALESCE($2, stage), notes = COALESCE($3, notes), updated_at = $4 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, stage ?? null, notes ?? null, now],
  );
  return r.rows[0] || null;
}

// Visitas por dia (fuso de Brasília) e tema
const dayOf = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

async function addVisit(tema, now = new Date()) {
  const day = dayOf(now);
  const p = db();
  if (!p) {
    const rows = await readJson(VISITS_FILE, []);
    const row = rows.find((r) => r.day === day && r.tema === tema);
    if (row) row.count++;
    else rows.push({ day, tema, count: 1 });
    return writeJson(VISITS_FILE, rows);
  }
  await p.query(
    'INSERT INTO visits (day, tema, count) VALUES ($1, $2, 1) ON CONFLICT (day, tema) DO UPDATE SET count = visits.count + 1',
    [day, tema],
  );
}

// from/to em YYYY-MM-DD (to exclusivo)
async function listVisits(from, to) {
  const p = db();
  if (!p) return (await readJson(VISITS_FILE, [])).filter((v) => (!from || v.day >= from) && (!to || v.day < to));
  const r = await p.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, tema, count FROM visits
      WHERE ($1::date IS NULL OR day >= $1) AND ($2::date IS NULL OR day < $2)`,
    [from || null, to || null],
  );
  return r.rows;
}

module.exports = { STAGES, STATUSES, dayOf, saveLead, markWhatsapp, queryLeads, getLead, updateLead, addVisit, listVisits };
