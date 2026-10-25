// Servidor local que imita a Vercel: arquivos de dist/ (com URLs limpas) e funções de api/.
// Uso: pnpm dev (gera dist/ antes). Porta: PORT ou 3100.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 3100;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function serveStatic(pathname, res) {
  const rel = decodeURIComponent(pathname).replace(/\/+$/, '') || '/index';
  const candidates = [rel, `${rel}.html`, path.join(rel, 'index.html')];
  for (const c of candidates) {
    const file = path.join(dist, c);
    if (!file.startsWith(dist)) break; // nada de ../ para fora de dist
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Não encontrado');
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
  serveStatic(pathname, res);
}).listen(port, () => console.log(`Funil em http://localhost:${port}`));
