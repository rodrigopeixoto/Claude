// Onde os dados ficam. Com DATABASE_URL usa Postgres; sem ela roda em modo demonstração:
// memória com leads e visitas fake (lib/demo.js). Leads novos entram na memória e somem quando a
// instância reinicia. Na Vercel cada instância tem a sua memória.

const fs = require('node:fs');
const path = require('node:path');
const { generateDemo, generatePageEvents } = require('./demo');
const { loadConfig } = require('./config');
const { clickTargets } = require('../shared/pageSchema');

const STAGES = ['novo', 'contatado', 'negociando', 'fechado', 'perdido'];
const STATUSES = ['qualified', 'downsell', 'material'];

const isDemo = () => !process.env.DATABASE_URL;

let pool;
function db() {
  if (isDemo()) return null;
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

// Páginas de exemplo: os JSON de pages/ (no Postgres são copiadas uma vez por seedOnce)
function examplePages() {
  const dir = path.join(__dirname, '..', 'pages');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch {}
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

let mem;
function memory() {
  if (!mem) {
    const pages = examplePages();
    const now = new Date().toISOString();
    mem = {
      ...generateDemo(loadConfig()),
      pages: pages.map((data) => ({ slug: data.slug, data, createdAt: now, updatedAt: now })),
      events: generatePageEvents(pages, clickTargets),
    };
  }
  mem.pages ||= [];
  mem.events ||= [];
  return mem;
}
// Para testes: recomeça a memória (com ou sem dados fake)
function resetMemory(data) {
  mem = data || null;
}

const COLUMNS = `id, code, status, stage, notes, answers, area_outro AS "areaOutro", nome, instagram, whatsapp, utm,
  elapsed_ms AS "elapsedMs", whatsapp_clicked_at AS "whatsappClickedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;

// Para fora o lead sai sem token, IP e user agent
const publicLead = ({ token, ip, userAgent, ...rest }) => ({ stage: 'novo', notes: '', updatedAt: null, whatsappClickedAt: null, ...rest });

async function saveLead(l) {
  const p = db();
  if (!p) {
    memory().leads.push({ stage: 'novo', notes: '', ...l });
    return;
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
    const row = memory().leads.find((r) => r.id === id && r.token === token);
    if (!row) return false;
    row.whatsappClickedAt ||= now.toISOString();
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
    const rows = memory().leads.filter((l) => matches(l, f)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    const row = memory().leads.find((r) => r.id === id);
    return row ? publicLead(row) : null;
  }
  const r = await p.query(`SELECT ${COLUMNS} FROM leads WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

// Só etapa e anotações mudam pelo painel
async function updateLead(id, { stage, notes }, now = new Date()) {
  const p = db();
  if (!p) {
    const row = memory().leads.find((r) => r.id === id);
    if (!row) return null;
    if (stage !== undefined) row.stage = stage;
    if (notes !== undefined) row.notes = notes;
    row.updatedAt = now.toISOString();
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
    const rows = memory().visits;
    const row = rows.find((r) => r.day === day && r.tema === tema);
    if (row) row.count++;
    else rows.push({ day, tema, count: 1 });
    return;
  }
  await p.query(
    'INSERT INTO visits (day, tema, count) VALUES ($1, $2, 1) ON CONFLICT (day, tema) DO UPDATE SET count = visits.count + 1',
    [day, tema],
  );
}

// from/to em YYYY-MM-DD (to exclusivo)
async function listVisits(from, to) {
  const p = db();
  if (!p) return memory().visits.filter((v) => (!from || v.day >= from) && (!to || v.day < to));
  const r = await p.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, tema, count FROM visits
      WHERE ($1::date IS NULL OR day >= $1) AND ($2::date IS NULL OR day < $2)`,
    [from || null, to || null],
  );
  return r.rows;
}

// ---------- páginas de links ----------

async function listPages() {
  const p = db();
  if (p) await seedOnce();
  if (!p) return memory().pages.map((r) => ({ ...r })).sort((a, b) => a.data.name.localeCompare(b.data.name));
  const r = await p.query(`SELECT slug, data, created_at AS "createdAt", updated_at AS "updatedAt" FROM link_pages ORDER BY data->>'name'`);
  return r.rows;
}

async function getPage(slug) {
  const p = db();
  if (p) await seedOnce();
  if (!p) {
    const row = memory().pages.find((r) => r.slug === slug);
    return row ? { ...row } : null;
  }
  const r = await p.query(`SELECT slug, data, created_at AS "createdAt", updated_at AS "updatedAt" FROM link_pages WHERE slug = $1`, [slug]);
  return r.rows[0] || null;
}

// Cria ou substitui. create: true recusa se já existir (devolve false)
async function savePage(data, { create = false } = {}, now = new Date()) {
  const p = db();
  const iso = now.toISOString();
  if (!p) {
    const pages = memory().pages;
    const row = pages.find((r) => r.slug === data.slug);
    if (row && create) return false;
    if (row) Object.assign(row, { data, updatedAt: iso });
    else pages.push({ slug: data.slug, data, createdAt: iso, updatedAt: iso });
    return true;
  }
  if (create) {
    const r = await p.query('INSERT INTO link_pages (slug, data, created_at, updated_at) VALUES ($1, $2, $3, $3) ON CONFLICT (slug) DO NOTHING', [data.slug, data, now]);
    return r.rowCount > 0;
  }
  await p.query(
    'INSERT INTO link_pages (slug, data, created_at, updated_at) VALUES ($1, $2, $3, $3) ON CONFLICT (slug) DO UPDATE SET data = $2, updated_at = $3',
    [data.slug, data, now],
  );
  return true;
}

async function deletePage(slug) {
  const p = db();
  if (!p) {
    const m = memory();
    const before = m.pages.length;
    m.pages = m.pages.filter((r) => r.slug !== slug);
    m.events = m.events.filter((e) => e.slug !== slug);
    return m.pages.length < before;
  }
  await p.query('DELETE FROM page_events WHERE slug = $1', [slug]);
  const r = await p.query('DELETE FROM link_pages WHERE slug = $1', [slug]);
  return r.rowCount > 0;
}

// No Postgres vazio, copia os exemplos de pages/ uma vez por instância (para não começar em branco)
let seeding;
function seedOnce() {
  seeding ||= (async () => {
    const p = db();
    const r = await p.query('SELECT count(*)::int AS n FROM link_pages');
    if (!r.rows[0].n) for (const data of examplePages()) await savePage(data, { create: true });
  })().catch((err) => { seeding = null; throw err; });
  return seeding;
}

async function addPageEvent(slug, key, now = new Date()) {
  const day = dayOf(now);
  const p = db();
  if (!p) {
    const ev = memory().events;
    const row = ev.find((e) => e.day === day && e.slug === slug && e.key === key);
    if (row) row.count++;
    else ev.push({ day, slug, key, count: 1 });
    return;
  }
  await p.query(
    'INSERT INTO page_events (day, slug, key, count) VALUES ($1, $2, $3, 1) ON CONFLICT (day, slug, key) DO UPDATE SET count = page_events.count + 1',
    [day, slug, key],
  );
}

// Soma por página e chave no período: [{ slug, key, count }]. from/to em YYYY-MM-DD (to exclusivo)
async function pageEventTotals(from, to, slug) {
  const p = db();
  if (!p) {
    const sums = new Map();
    for (const e of memory().events) {
      if ((from && e.day < from) || (to && e.day >= to) || (slug && e.slug !== slug)) continue;
      const k = `${e.slug}|${e.key}`;
      sums.set(k, (sums.get(k) || 0) + e.count);
    }
    return [...sums].map(([k, count]) => { const [s, key] = k.split('|'); return { slug: s, key, count }; });
  }
  const r = await p.query(
    `SELECT slug, key, sum(count)::int AS count FROM page_events
      WHERE ($1::date IS NULL OR day >= $1) AND ($2::date IS NULL OR day < $2) AND ($3::text IS NULL OR slug = $3)
      GROUP BY slug, key`,
    [from || null, to || null, slug || null],
  );
  return r.rows;
}

module.exports = {
  STAGES, STATUSES, isDemo, resetMemory, dayOf,
  saveLead, markWhatsapp, queryLeads, getLead, updateLead, addVisit, listVisits,
  listPages, getPage, savePage, deletePage, addPageEvent, pageEventTotals,
};
