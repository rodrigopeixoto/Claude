// Servidor local que imita a Vercel: arquivos de dist/ (com URLs limpas), funções de api/ e /<slug> das páginas de links.
// Uso: pnpm dev (gera dist/ antes). Porta: PORT ou 3100.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 3100;

// Só no servidor local: sem ADMIN_PASSWORD o painel abre com a senha "demo" (nunca em produção)
const defaultPassword = !process.env.ADMIN_PASSWORD;
if (defaultPassword) process.env.ADMIN_PASSWORD = 'demo';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function serveStatic(pathname, res) {
  const rel = decodeURIComponent(pathname).replace(/\/+$/, '') || '/index';
  const candidates = [rel, `${rel}.html`, path.join(rel, 'index.html')];
  for (const c of candidates) {
    const file = path.join(dist, c);
    if (!file.startsWith(dist)) break; // nada de ../ para fora de dist
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
      return true;
    }
  }
  return false;
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const m = pathname.match(/^\/api\/([a-z0-9-]+)\/?$/);
  if (m) {
    const file = path.join(root, 'api', `${m[1]}.js`);
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end('{"error":"Não encontrado"}');
    }
    return require(file)(req, res);
  }
  if (serveStatic(pathname, res)) return;
  // /<slug> sem arquivo estático: página de links (igual ao rewrite da Vercel)
  const page = pathname.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (page) {
    const q = new URL(req.url, 'http://localhost').searchParams;
    q.set('slug', page[1]);
    req.url = `/api/page?${q}`;
    return require(path.join(root, 'api', 'page.js'))(req, res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Não encontrado');
}).listen(port, () => {
  console.log(`Landing: http://localhost:${port}`);
  console.log(`Painel:  http://localhost:${port}/admin`);
  console.log(process.env.DATABASE_URL ? 'Banco: Postgres (DATABASE_URL)' : 'Banco: nenhum, modo demonstração com dados fake');
  if (defaultPassword) console.log('Senha do painel: demo  (defina ADMIN_PASSWORD para trocar)');
});
