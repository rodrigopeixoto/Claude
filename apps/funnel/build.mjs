// Gera dist/ a partir de src/ + funnel.config.json.
// Nos templates: {{caminho.no.config}} entra escapado, {{{caminho}}} entra como HTML.

import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { loadConfig } = require('./lib/config.js');

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

async function build() {
  const cfg = loadConfig();
  const tema = cfg.brand.themeDefault === 'claro' ? 'claro' : 'escuro';
  const ctx = {
    ...cfg,
    year: new Date().getFullYear(),
    temaDefault: tema,
    abTest: cfg.brand.abTest ? 'true' : 'false',
    heroTitle: cfg.hero.titleLines.map((l) => `<span class="line"><span>${esc(l)}</span></span>`).join(''),
    questionsHtml: questionsHtml(cfg.quiz),
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
  for (const key of ['downsell', 'material']) {
    const page = cfg.pages[key];
    await write(`${key}.html`, 'page.html', {
      page: { ...page, priceHtml: page.price ? `<p class="page-price">${esc(page.price)}</p>` : '' },
    });
  }
  console.log('dist/ gerado');
}

build().catch((err) => { console.error(err); process.exit(1); });
