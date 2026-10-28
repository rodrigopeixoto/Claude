// Parser de slides + render de markdown simples. Usado por popup e teleprompter.
const TP = (() => {
  const SLIDE_RE = /^\s*(?:#{1,6}\s*)?[*_]*\s*slide\s+(\d+)\s*[*_]*\s*(?:[:\-–—.]\s*)?(.*?)\s*[*_]*\s*$/i;

  function parseSlides(text) {
    text = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
    const slides = [];
    let cur = null;
    for (const line of text.split('\n')) {
      const m = line.match(SLIDE_RE);
      if (m) {
        cur = { n: Number(m[1]), title: m[2] || '', lines: [] };
        slides.push(cur);
      } else if (cur) {
        cur.lines.push(line);
      }
    }
    if (!slides.length) {
      // sem marcador "Slide X": separa por --- ou usa texto todo como 1 slide
      return text
        .split(/^\s*---+\s*$/m)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((body, i) => ({ n: i + 1, title: '', body }));
    }
    return slides.map((s) => ({ n: s.n, title: s.title, body: s.lines.join('\n').trim() }));
  }

  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function inline(s) {
    return esc(s)
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, '$1<em>$2</em>');
  }

  function renderBody(body) {
    const out = [];
    for (const raw of body.replace(/\t/g, '  ').split('\n')) {
      if (!raw.trim()) continue;
      let m;
      if ((m = raw.match(/^(#{1,6})\s+(.*)$/))) {
        out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      } else if ((m = raw.match(/^(\s*)[-*•]\s+(.*)$/))) {
        const lvl = Math.min(4, Math.floor(m[1].length / 2));
        out.push(`<div class="li" style="--lvl:${lvl}">${inline(m[2])}</div>`);
      } else if ((m = raw.match(/^(\s*)(\d+)[.)]\s+(.*)$/))) {
        const lvl = Math.min(4, Math.floor(m[1].length / 2));
        out.push(`<div class="li num" style="--lvl:${lvl}"><span class="n">${m[2]}.</span>${inline(m[3])}</div>`);
      } else {
        out.push(`<p>${inline(raw.trim())}</p>`);
      }
    }
    return out.join('');
  }

  return { parseSlides, renderBody, esc };
})();
