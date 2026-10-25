// Gera dist/ a partir de src/ + funnel.config.json.
// Nos templates: {{caminho.no.config}} entra escapado, {{{caminho}}} entra como HTML.

import { readFile, writeFile, mkdir, cp, rm, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { loadConfig } = require('./lib/config.js');
import { renderLinkPage } from './linkpage.mjs';

const out = path.join(root, 'dist');
const KEYS = 'ABCDEFGHIJ';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function render(tpl, ctx) {
  return tpl
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, p) => {
      const v = get(ctx, p);
      if (v === undefined) throw new Error(`Template: chave ausente "${p}"`);
      return String(v);
    })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => {
      const v = get(ctx, p);
      if (v === undefined) throw new Error(`Template: chave ausente "${p}"`);
      return esc(v);
    });
}

function optionHtml(o, i) {
  const rich = o.price || o.sub;
  const body = rich
    ? `<span class="opt-body"><span class="opt-name">${esc(o.label)}</span>${o.price ? `<span class="opt-price">${esc(o.price)}</span>` : ''}${o.sub ? `<span class="opt-sub">${esc(o.sub)}</span>` : ''}</span>`
    : `<span class="opt-label">${esc(o.label)}</span>`;
  return `<button type="button" class="option" data-value="${esc(o.value)}"><span class="key">${KEYS[i]}</span>${body}</button>`;
}

function questionsHtml(quiz) {
  const total = quiz.questions.length;
  return quiz.questions.map((q, n) => {
    const other = q.otherField
      ? `
        <div class="field other-field" hidden>
          <label for="areaOutro">${esc(q.otherField.label)}</label>
          <input id="areaOutro" name="areaOutro" autocomplete="organization-title" placeholder="${esc(q.otherField.placeholder || '')}" />
          <span class="err">Conte qual é a sua profissão.</span>
        </div>`
      : '';
    return `
      <section class="step" data-step="${esc(q.id)}">
        <p class="step-label">Pergunta ${n + 1} de ${total}</p>
        <h2>${esc(q.title)}</h2>
        ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}
        <div class="options" data-name="${esc(q.id)}">
          ${q.options.map(optionHtml).join('\n          ')}
        </div>${other}
      </section>`;
  }).join('\n');
}

function listHtml(items, icon) {
  return items.map((t) => `<li><span class="mark mark--${icon}" aria-hidden="true"></span>${esc(t)}</li>`).join('');
}

// Páginas de links dos clientes: pages/*.json → dist/<slug>.html
async function loadLinkPages() {
  const dir = path.join(root, 'pages');
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'));
  const pages = [];
  for (const f of files) {
    let page;
    try { page = JSON.parse(await readFile(path.join(dir, f), 'utf8')); } catch (e) { throw new Error(`pages/${f}: JSON inválido (${e.message})`); }
    if (pages.some((p) => p.slug === page.slug)) throw new Error(`pages/${f}: slug "${page.slug}" repetido`);
    pages.push({ ...page, file: `pages/${f}` });
  }
  return pages;
}

// Celulares do topo da landing: as páginas de exemplo ao vivo; sem exemplos, o desenho em CSS
function showcaseHtml(slugs, pages) {
  const found = (slugs || []).map((s) => {
    const p = pages.find((x) => x.slug === s);
    if (!p) throw new Error(`hero.showcase: página "${s}" não existe em pages/`);
    return p;
  });
  if (!found.length) return null;
  // o do meio fica em destaque
  const order = found.length === 3 ? [found[1], found[0], found[2]] : found;
  return order.map((p, i) => {
    const side = found.length === 3 && i !== 1 ? ' device--side' : '';
    return `<div class="device${side}"><div class="device-screen"><iframe src="/${esc(p.slug)}" title="Página de exemplo: ${esc(p.name)}" tabindex="-1" aria-hidden="true"></iframe></div></div>`;
  }).join('');
}

function mockDevice(cfg) {
  return `<div class="device"><div class="device-screen"><div class="mock">
    <div class="mock-cover"></div><div class="mock-avatar"></div>
    <p class="mock-name">${esc(cfg.brand.author)}</p><p class="mock-role">Sua profissão aqui</p>
    <div class="mock-block mock-block--hero"></div>
    <div class="mock-row"><div class="mock-block"></div><div class="mock-block"></div></div>
    <div class="mock-block mock-block--wide"></div><div class="mock-block mock-block--wide"></div>
  </div></div></div>`;
}

async function build() {
  const cfg = loadConfig();
  const linkPages = await loadLinkPages();
  const tema = cfg.brand.themeDefault === 'claro' ? 'claro' : 'escuro';
  const ctx = {
    ...cfg,
    year: new Date().getFullYear(),
    temaDefault: tema,
    abTest: cfg.brand.abTest ? 'true' : 'false',
    heroTitle: cfg.hero.titleLines.map((l) => `<span class="line"><span>${esc(l)}</span></span>`).join(''),
    questionsHtml: questionsHtml(cfg.quiz),
    stageInner: showcaseHtml(cfg.hero.showcase, linkPages) || mockDevice(cfg),
    stageClass: cfg.hero.showcase?.length ? 'stage stage--live' : 'stage',
    compareThem: listHtml(cfg.sections.compare.them.items, 'x'),
    compareUs: listHtml(cfg.sections.compare.us.items, 'ok'),
    // dados que o quiz precisa no navegador; "<" escapado para não fechar a tag <script>
    quizJson: JSON.stringify({ questions: cfg.quiz.questions }).replace(/</g, '\\u003c'),
  };

  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, 'js'), { recursive: true });
  await cp(path.join(root, 'src', 'assets'), out, { recursive: true });
  for (const f of ['qualify.js', 'phone.js']) await cp(path.join(root, 'shared', f), path.join(out, 'js', f));

  const write = async (file, tpl, extra = {}) => {
    const html = render(await readFile(path.join(root, 'src', tpl), 'utf8'), { ...ctx, ...extra });
    await writeFile(path.join(out, file), html);
  };
  await write('index.html', 'index.html');
  await write('admin.html', 'admin.html');
  for (const key of ['downsell', 'material']) {
    const page = cfg.pages[key];
    await write(`${key}.html`, 'page.html', {
      page: { ...page, priceHtml: page.price ? `<p class="page-price">${esc(page.price)}</p>` : '' },
    });
  }
  for (const p of linkPages) await writeFile(path.join(out, `${p.slug}.html`), renderLinkPage(p, p.file));
  console.log(`dist/ gerado (${linkPages.length} página(s) de links: ${linkPages.map((p) => '/' + p.slug).join(', ') || 'nenhuma'})`);
}

build().catch((err) => { console.error(err); process.exit(1); });
