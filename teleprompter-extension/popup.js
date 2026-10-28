const $ = (id) => document.getElementById(id);
const status = (msg, err = false) => {
  $('status').textContent = msg;
  $('status').className = err ? 'err' : '';
};

function htmlToMarkdown(doc) {
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER', 'SVG']);
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE || skip.has(node.tagName)) return '';
    const inner = Array.from(node.childNodes).map(walk).join('');
    const tag = node.tagName.toLowerCase();
    if (tag === 'b' || tag === 'strong') return inner.trim() ? `**${inner.trim()}** ` : '';
    if (tag === 'i' || tag === 'em') return inner.trim() ? `*${inner.trim()}* ` : '';
    if (/^h[1-6]$/.test(tag)) return `\n${'#'.repeat(Number(tag[1]))} ${inner.trim()}\n`;
    if (tag === 'li') return `\n- ${inner.trim()}`;
    if (['p', 'div', 'br', 'tr', 'ul', 'ol', 'section', 'article'].includes(tag)) return `\n${inner}\n`;
    return inner;
  }
  return walk(doc.body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function fetchContent(rawUrl) {
  const u = new URL(rawUrl);
  let target = rawUrl;
  const gd = u.hostname === 'docs.google.com' && u.pathname.match(/\/(document|presentation)\/d\/([^/]+)/);
  if (gd) {
    target =
      gd[1] === 'document'
        ? `https://docs.google.com/document/d/${gd[2]}/export?format=txt`
        : `https://docs.google.com/presentation/d/${gd[2]}/export/txt`;
  }
  const res = await fetch(target, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  const body = await res.text();
  if (gd && (type.includes('html') || res.url.includes('accounts.google.com'))) {
    throw new Error('Sem acesso ao Google Doc/Slides. Logue no Chrome com conta que tem acesso.');
  }
  if (type.includes('html')) return htmlToMarkdown(new DOMParser().parseFromString(body, 'text/html'));
  return body.replace(/^﻿/, '');
}

$('load').addEventListener('click', async () => {
  const url = $('url').value.trim();
  if (!url) return status('Cole uma URL.', true);
  status('Carregando...');
  try {
    $('text').value = await fetchContent(url);
    chrome.storage.local.set({ draft: $('text').value, draftUrl: url });
    status(`Carregado. ${TP.parseSlides($('text').value).length} slide(s) detectado(s).`);
  } catch (e) {
    status(`Falha: ${e.message}`, true);
  }
});

$('text').addEventListener('input', () => chrome.storage.local.set({ draft: $('text').value }));

$('send').addEventListener('click', async () => {
  const slides = TP.parseSlides($('text').value);
  if (!slides.length) return status('Nada pra enviar.', true);
  await chrome.storage.local.set({ slides, index: 0, draft: $('text').value });
  chrome.runtime.sendMessage({ type: 'open' });
  window.close();
});

chrome.storage.local.get(['draft', 'draftUrl']).then(({ draft, draftUrl }) => {
  if (draft) $('text').value = draft;
  if (draftUrl) $('url').value = draftUrl;
});
