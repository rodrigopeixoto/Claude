// Página de links do cliente: pages/<slug>.json → dist/<slug>.html (URL /<slug>).
// Cada página é uma lista de blocos; a ordem e a escolha dos blocos é o que deixa uma diferente da outra.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Rotas da landing e do painel: um cliente não pode ter esse endereço
export const RESERVED = ['index', 'admin', 'downsell', 'material', 'api', 'js', 'img', 'p', 'styles', 'linkpage'];

// Ícones de traço (24x24), desenhados com currentColor
const ICON_PATHS = {
  whatsapp: '<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a4.5 4.5 0 0 1-2.2-2.2l.8-1-1-2z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.5 2.5 4.5 5 4.5"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V16M8 7.5v.01M12 16v-5.5M12 13c0-2 1-2.5 2.2-2.5S16 11 16 13v3"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  map: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M19 19v2H6"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3.5 8 4.5 9 8 12 8zM12 8s1.5-4.5 4-3.5S15 8 12 8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
};
const icon = (name, cls = 'ic') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.link}</svg>`;

const SOCIAL = {
  instagram: (v) => `https://instagram.com/${encodeURIComponent(v.replace(/^@/, ''))}`,
  youtube: (v) => (v.startsWith('http') ? v : `https://youtube.com/@${encodeURIComponent(v.replace(/^@/, ''))}`),
  tiktok: (v) => `https://tiktok.com/@${encodeURIComponent(v.replace(/^@/, ''))}`,
  linkedin: (v) => (v.startsWith('http') ? v : `https://linkedin.com/in/${encodeURIComponent(v)}`),
  email: (v) => `mailto:${v}`,
};

const waUrl = (number, message) => `https://wa.me/${String(number).replace(/\D/g, '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

// Só http(s), mailto, tel, wa.me e caminhos locais: nada de javascript: num link vindo do JSON
function safeUrl(u, where) {
  const s = String(u || '').trim();
  if (!s) throw new Error(`${where}: falta o link (ou a mensagem de WhatsApp)`);
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(s)) return s;
  throw new Error(`${where}: link inválido "${s}" (use https://, mailto:, tel: ou /caminho)`);
}

// Link de item: aceita url ou whatsapp (+ mensagem)
function itemHref(it, page, where) {
  if (it.whatsapp || it.whatsappMessage) return waUrl(it.whatsapp || page.whatsapp, it.whatsappMessage);
  return safeUrl(it.url, where);
}
const target = (href) => (/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '');

const initials = (name) => name.replace(/^(dra?|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// ---------- blocos ----------
const BLOCKS = {
  // Card grande com imagem/gradiente, texto e botão: a oferta principal
  highlight(b, page, where, i) {
    const href = b.button ? itemHref(b.button, page, `${where}.button`) : null;
    const media = b.image ? `<img src="${esc(safeUrl(b.image, `${where}.image`))}" alt="" loading="lazy" />` : '';
    return `
      <section class="blk hl${b.image ? ' hl--img' : ''}">
        ${media}
        <div class="hl-body">
          ${b.tag ? `<span class="tag">${esc(b.tag)}</span>` : ''}
          <h2>${esc(b.title)}</h2>
          ${b.text ? `<p>${esc(b.text)}</p>` : ''}
          ${href ? `<a class="btn" data-k="b${i}" href="${esc(href)}"${target(href)}>${esc(b.button.label)} ${icon('arrow')}</a>` : ''}
        </div>
      </section>`;
  },

  // Lista de botões com ícone, título e subtítulo
  links(b, page, where, bi) {
    return `
      <section class="blk">
        ${b.title ? `<h3 class="blk-title">${esc(b.title)}</h3>` : ''}
        <div class="links">
          ${b.items.map((it, i) => {
            const href = itemHref(it, page, `${where}.items[${i}]`);
            return `<a class="lk" data-k="b${bi}-${i}" href="${esc(href)}"${target(href)}>
              <span class="lk-ic">${icon(it.icon || 'link')}</span>
              <span class="lk-txt"><strong>${esc(it.label)}</strong>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
              ${icon('arrow', 'ic lk-go')}
            </a>`;
          }).join('')}
        </div>
      </section>`;
  },

  // Vitrine em grade (produtos, serviços, projetos)
  grid(b, page, where, bi) {
    return `
      <section class="blk">
        ${b.title ? `<h3 class="blk-title">${esc(b.title)}</h3>` : ''}
        <div class="grid">
          ${b.items.map((it, i) => {
            const href = it.url || it.whatsapp || it.whatsappMessage ? itemHref(it, page, `${where}.items[${i}]`) : null;
            const tagOpen = href ? `<a class="gi" data-k="b${bi}-${i}" href="${esc(href)}"${target(href)}>` : '<div class="gi">';
            const thumb = it.image
              ? `<img src="${esc(safeUrl(it.image, `${where}.items[${i}].image`))}" alt="" loading="lazy" />`
              : `<span class="gi-ph" style="--h:${(i * 47) % 360}">${icon(it.icon || 'star')}</span>`;
            return `${tagOpen}${thumb}<span class="gi-txt"><strong>${esc(it.title)}</strong>${it.price ? `<small>${esc(it.price)}</small>` : ''}</span>${href ? '</a>' : '</div>'}`;
          }).join('')}
        </div>
      </section>`;
  },

  // Vídeo do YouTube (domínio sem cookies), carrega só ao tocar
  video(b, page, where, bi) {
    const id = String(b.youtube || '');
    if (!/^[\w-]{11}$/.test(id)) throw new Error(`${where}: "youtube" deve ser o id de 11 caracteres do vídeo`);
    return `
      <section class="blk">
        ${b.title ? `<h3 class="blk-title">${esc(b.title)}</h3>` : ''}
        <button type="button" class="vid" data-k="b${bi}" data-yt="${id}" aria-label="Assistir: ${esc(b.title || 'vídeo')}">
          <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" />
          ${icon('play', 'ic vid-play')}
        </button>
      </section>`;
  },

  testimonials(b) {
    return `
      <section class="blk">
        ${b.title ? `<h3 class="blk-title">${esc(b.title)}</h3>` : ''}
        <div class="quotes">
          ${b.items.map((q) => `
            <figure class="quote">
              <div class="stars" aria-label="5 estrelas">${icon('star', 'ic st')}${icon('star', 'ic st')}${icon('star', 'ic st')}${icon('star', 'ic st')}${icon('star', 'ic st')}</div>
              <blockquote>${esc(q.text)}</blockquote>
              <figcaption>${esc(q.author)}</figcaption>
            </figure>`).join('')}
        </div>
      </section>`;
  },

  location(b, page, where, bi) {
    const maps = b.mapsUrl ? safeUrl(b.mapsUrl, `${where}.mapsUrl`) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`;
    return `
      <section class="blk">
        ${b.title ? `<h3 class="blk-title">${esc(b.title)}</h3>` : ''}
        <a class="loc" data-k="b${bi}" href="${esc(maps)}" target="_blank" rel="noopener">
          <span class="lk-ic">${icon('map')}</span>
          <span class="lk-txt"><strong>${esc(b.address)}</strong>${b.hours ? `<small>${icon('clock', 'ic ic-sm')} ${esc(b.hours)}</small>` : ''}</span>
          ${icon('arrow', 'ic lk-go')}
        </a>
      </section>`;
  },

  faq(b) {
    return `
      <section class="blk">
        ${b.title ? `<h3 class="blk-title">${esc(b.title)}</h3>` : ''}
        <div class="faq">
          ${b.items.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
        </div>
      </section>`;
  },

  // Linha de números/credenciais
  stats(b) {
    return `
      <section class="blk stats">
        ${b.items.map((s) => `<div><strong>${esc(s.value)}</strong><small>${esc(s.label)}</small></div>`).join('')}
      </section>`;
  },
};

const FONTS = {
  sans: { css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", google: null },
  serif: { css: "'Fraunces', Georgia, serif", google: 'Fraunces:opsz,wght@9..144,500;9..144,600' },
  rounded: { css: "'Nunito', -apple-system, sans-serif", google: 'Nunito:wght@500;700;800' },
};

function validate(page, file) {
  const need = (cond, msg) => { if (!cond) throw new Error(`${file}: ${msg}`); };
  need(typeof page.slug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(page.slug), '"slug" só com letras minúsculas, números e hífen (ex.: dra-ana-lima)');
  need(!RESERVED.includes(page.slug), `"slug" "${page.slug}" é reservado`);
  need(typeof page.name === 'string' && page.name.trim(), '"name" é obrigatório');
  need(Array.isArray(page.blocks), '"blocks" deve ser uma lista');
  page.blocks.forEach((b, i) => need(BLOCKS[b.type], `blocks[${i}]: tipo "${b.type}" não existe (use: ${Object.keys(BLOCKS).join(', ')})`));
  const accent = page.theme?.accent;
  need(!accent || /^#[0-9a-f]{6}$/i.test(accent), '"theme.accent" deve ser uma cor #rrggbb');
}

// opts.track: conta visita e cliques (desligado na prévia do painel e na vitrine da landing)
export function renderLinkPage(page, file, opts = {}) {
  validate(page, file);
  const theme = { style: 'claro', accent: '#0066ff', font: 'sans', ...page.theme };
  const font = FONTS[theme.font] || FONTS.sans;

  const cover = page.cover?.image
    ? `<div class="cover"><img src="${esc(safeUrl(page.cover.image, `${file}: cover.image`))}" alt="" /></div>`
    : `<div class="cover cover--grad"></div>`;
  const avatar = page.avatar
    ? `<img class="avatar" src="${esc(safeUrl(page.avatar, `${file}: avatar`))}" alt="${esc(page.name)}" width="104" height="104" />`
    : `<div class="avatar avatar--txt" aria-hidden="true">${esc(initials(page.name))}</div>`;

  const social = Object.entries(page.social || {}).filter(([k, v]) => SOCIAL[k] && v)
    .map(([k, v]) => `<a data-k="s-${k}" href="${esc(SOCIAL[k](v))}"${k === 'email' ? '' : ' target="_blank" rel="noopener"'} aria-label="${k}">${icon(k)}</a>`).join('');

  const blocks = page.blocks.map((b, i) => BLOCKS[b.type](b, page, `${file}: blocks[${i}]`, i)).join('\n');

  const cta = page.cta
    ? `<a class="fab" data-k="cta" href="${esc(waUrl(page.cta.whatsapp || page.whatsapp, page.cta.message))}" target="_blank" rel="noopener">${icon('whatsapp')} ${esc(page.cta.label || 'Falar no WhatsApp')}</a>`
    : '';

  const title = `${page.name}${page.role ? ` | ${page.role}` : ''}`;
  const description = page.description || page.bio || page.role || '';

  return `<!doctype html>
<html lang="pt-BR" data-tema="${theme.style === 'escuro' ? 'escuro' : 'claro'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  ${page.avatar ? `<meta property="og:image" content="${esc(page.avatar)}" />` : ''}
  ${font.google ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font.google}&display=swap" />` : ''}
  <link rel="stylesheet" href="/linkpage.css" />
  <style>:root { --accent: ${theme.accent}; --font-display: ${font.css}; }</style>
</head>
<body class="lp">
  <main class="lp-wrap">
    <header class="lp-head">
      ${cover}
      ${avatar}
      <h1>${esc(page.name)}${page.verified ? `<span class="verified" title="Perfil verificado">${icon('check', 'ic')}</span>` : ''}</h1>
      ${page.role ? `<p class="role">${esc(page.role)}</p>` : ''}
      ${page.location ? `<p class="loc-line">${icon('map', 'ic ic-sm')} ${esc(page.location)}</p>` : ''}
      ${page.bio ? `<p class="bio">${esc(page.bio)}</p>` : ''}
      ${page.badges?.length ? `<ul class="badges">${page.badges.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${social ? `<nav class="social" aria-label="Redes sociais">${social}</nav>` : ''}
    </header>
${blocks}
    <footer class="lp-foot">${esc(page.footer || `© ${new Date().getFullYear()} ${page.name}`)}</footer>
  </main>
  ${cta}
  ${opts.track ? `<script>
    // visita e cliques por link (sendBeacon não segura a saída da página)
    (function () {
      var slug = ${JSON.stringify(page.slug)};
      function hit(k) {
        var body = JSON.stringify({ slug: slug, key: k });
        if (!(navigator.sendBeacon && navigator.sendBeacon('/api/click', new Blob([body], { type: 'application/json' })))) {
          fetch('/api/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
        }
      }
      try { if (!sessionStorage.getItem('v_' + slug)) { sessionStorage.setItem('v_' + slug, '1'); hit('view'); } } catch (e) { hit('view'); }
      document.addEventListener('click', function (e) { var a = e.target.closest('[data-k]'); if (a) hit(a.dataset.k); });
    })();
  </script>` : ''}
  <script>
    // vídeo do YouTube só carrega quando a pessoa toca (página leve e sem cookies antes disso)
    document.querySelectorAll('.vid').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0';
        f.allow = 'autoplay; encrypted-media; picture-in-picture';
        f.allowFullscreen = true;
        f.title = b.getAttribute('aria-label');
        b.replaceWith(f);
      });
    });
  </script>
</body>
</html>
`;
}
