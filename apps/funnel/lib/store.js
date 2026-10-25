// Onde os leads ficam. Com DATABASE_URL usa Postgres; sem ela grava em .data/leads.json
// (só para desenvolvimento: na Vercel o disco é temporário).

const fs = require('node:fs/promises');
const path = require('node:path');

const FILE = process.env.FUNNEL_DATA_FILE || path.join(__dirname, '..', '.data', 'leads.json');

let pool;
function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

async function readFile() {
  try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return []; }
}
async function writeFile(rows) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

async function saveLead(l) {
  const p = db();
  if (!p) {
    const rows = await readFile();
    rows.push(l);
    return writeFile(rows);
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
    const rows = await readFile();
    const row = rows.find((r) => r.id === id && r.token === token);
    if (!row) return false;
    row.whatsappClickedAt ||= now.toISOString();
    await writeFile(rows);
    return true;
  }
  const r = await p.query(
    'UPDATE leads SET whatsapp_clicked_at = COALESCE(whatsapp_clicked_at, $3) WHERE id = $1 AND token = $2',
    [id, token, now],
  );
  return r.rowCount > 0;
}

async function listLeads(limit = 500) {
  const p = db();
  if (!p) return (await readFile()).slice(-limit).reverse().map(({ token, ...rest }) => rest);
  const r = await p.query(
    `SELECT id, code, status, answers, area_outro AS "areaOutro", nome, instagram, whatsapp, utm, elapsed_ms AS "elapsedMs",
            whatsapp_clicked_at AS "whatsappClickedAt", created_at AS "createdAt"
       FROM leads ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return r.rows;
}

module.exports = { saveLead, markWhatsapp, listLeads };
