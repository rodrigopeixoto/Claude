// Painel, aba Páginas: lista das páginas de links e editor com prévia ao vivo e cliques por link.

(() => {
  const { $, $$, esc, api, nf, pct, dt, range } = window.FAdmin;
  const S = window.FPageSchema;

  const state = { slug: null, draft: null, dirty: false };

  // ---------- caminho "blocks.2.items.0.label" ----------
  const parts = (path) => path.split('.').map((k) => (/^\d+$/.test(k) ? Number(k) : k));
  function getPath(obj, path) {
    return parts(path).reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const ks = parts(path);
    let o = obj;
    ks.slice(0, -1).forEach((k, i) => {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = typeof ks[i + 1] === 'number' ? [] : {};
      o = o[k];
    });
    o[ks[ks.length - 1]] = value;
  }

  const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^(dra?|prof)\.?\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

  // ---------- lista ----------
  async function loadList() {
    const { from, to } = range();
    const { pages } = await api(`/api/pages?from=${from}&to=${to}`);
    $('#pagesTable tbody').innerHTML = pages.map((p) => `
      <tr data-slug="${esc(p.slug)}" tabindex="0">
        <td><span class="pg-dot" style="background:${esc(p.accent || '#0066ff')}"></span><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></td>
        <td><a href="/${esc(p.slug)}" target="_blank" rel="noopener" class="pg-link">/${esc(p.slug)}</a></td>
        <td>${nf.format(p.views)}</td>
        <td>${nf.format(p.clicks)}</td>
        <td>${p.views ? pct(p.clicks / p.views) : '—'}</td>
        <td class="nowrap">${p.updatedAt ? esc(dt(p.updatedAt)) : '—'}</td>
      </tr>`).join('');
    $('#pagesEmpty').hidden = pages.length > 0;
    $('#npFrom').innerHTML = '<option value="">Página em branco</option>' + pages.map((p) => `<option value="${esc(p.slug)}">Cópia de ${esc(p.name)}</option>`).join('');
  }

  const tbody = $('#pagesTable tbody');
  tbody.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const tr = e.target.closest('tr[data-slug]');
    if (tr) openEditor(tr.dataset.slug);
  });
  tbody.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-slug]');
    if (tr && e.key === 'Enter') openEditor(tr.dataset.slug);
  });

  // ---------- nova página ----------
  let slugTouched = false;
  $('#newPageBtn').addEventListener('click', () => {
    $('#newPageForm').hidden = false;
    $('#npError').hidden = true;
    slugTouched = false;
    $('#npName').value = $('#npSlug').value = '';
    $('#npName').focus();
  });
  $('#npCancel').addEventListener('click', () => { $('#newPageForm').hidden = true; });
  $('#npName').addEventListener('input', () => { if (!slugTouched) $('#npSlug').value = slugify($('#npName').value); });
  $('#npSlug').addEventListener('input', () => { slugTouched = true; });
  $('#newPageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#npError').hidden = true;
    try {
      const { page } = await api('/api/pages', { method: 'POST', body: { name: $('#npName').value, slug: $('#npSlug').value.trim(), from: $('#npFrom').value } });
      $('#newPageForm').hidden = true;
      openEditor(page.slug);
    } catch (err) {
      $('#npError').textContent = err.message;
      $('#npError').hidden = false;
    }
  });

  // ---------- editor ----------
  async function openEditor(slug) {
    if (state.dirty && state.slug !== slug && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    const { from, to } = range();
    const data = await api(`/api/pages?slug=${encodeURIComponent(slug)}&from=${from}&to=${to}`);
    state.slug = slug;
    state.draft = structuredClone(data.page);
    state.dirty = false;
    $('#pagesList').hidden = true;
    $('#pageEditor').hidden = false;
    $('#peName').textContent = data.page.name;
    $('#peOpen').href = `/${slug}`;
    $('#peOpen').textContent = `/${slug} ↗`;
    $('#peSaved').textContent = data.updatedAt ? `Salva ${dt(data.updatedAt)}` : '';
    renderForm();
    renderStats(data.stats);
    preview();
    history.replaceState(null, '', `#pages/${slug}`);
    scrollTo(0, 0);
  }

  function closeEditor() {
    if (state.dirty && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    state.slug = state.draft = null;
    state.dirty = false;
    $('#pageEditor').hidden = true;
    $('#pagesList').hidden = false;
    history.replaceState(null, '', '#pages');
    loadList();
  }
  $('#peBack').addEventListener('click', closeEditor);

  function markDirty() {
    state.dirty = true;
    $('#peSaved').textContent = 'Alterações não salvas';
    schedulePreview();
  }
  window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- formulário ----------
  function fieldHtml(f, path) {
    const v = getPath(state.draft, path);
    const id = `f-${path.replace(/\./g, '-')}`;
    const attrs = `id="${id}" data-path="${esc(path)}" data-type="${f.type}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}`;
    let input;
    switch (f.type) {
      case 'textarea':
        input = `<textarea ${attrs} rows="3">${esc(v || '')}</textarea>`;
        break;
      case 'select':
        input = `<select ${attrs}>${f.options.map(([val, label]) => `<option value="${esc(val)}"${(v || f.options[0][0]) === val ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
        break;
      case 'color':
        input = `<div class="color-row"><input type="color" ${attrs} value="${esc(v || '#0066ff')}" /><code>${esc(v || '#0066ff')}</code></div>`;
        break;
      case 'checkbox':
        return `<label class="check"><input type="checkbox" ${attrs}${v ? ' checked' : ''} /> ${esc(f.label)}</label>`;
      case 'list':
        input = `<input ${attrs} value="${esc((v || []).join(', '))}" />`;
        break;
      default:
        input = `<input ${attrs} type="${f.type === 'url' ? 'url' : 'text'}" value="${esc(v ?? '')}" />`;
    }
    return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}</div>`;
  }

  const section = (title, body, open = false) => `<details class="pe-sec"${open ? ' open' : ''}><summary>${esc(title)}</summary><div class="pe-sec-body">${body}</div></details>`;
  const tools = (act, b, i, first, last) => `
    <span class="pe-tools">
      <button type="button" class="icon-btn" data-act="${act}-up" data-b="${b}"${i != null ? ` data-i="${i}"` : ''} aria-label="Subir"${first ? ' disabled' : ''}>↑</button>
      <button type="button" class="icon-btn" data-act="${act}-down" data-b="${b}"${i != null ? ` data-i="${i}"` : ''} aria-label="Descer"${last ? ' disabled' : ''}>↓</button>
      <button type="button" class="icon-btn" data-act="${act}-del" data-b="${b}"${i != null ? ` data-i="${i}"` : ''} aria-label="Remover">✕</button>
    </span>`;

  function blockHtml(b, bi, total) {
    const def = S.BLOCKS[b.type] || { label: b.type, fields: [] };
    const fields = def.fields.map((f) => fieldHtml(f, `blocks.${bi}.${f.key}`)).join('');
    let items = '';
    if (def.items) {
      const list = b.items || [];
      items = `<div class="pe-items">${list.map((it, ii) => `
        <div class="pe-item">
          <div class="pe-item-head"><span>${esc(it.label || it.title || it.q || it.value || it.author || `Item ${ii + 1}`)}</span>${tools('item', bi, ii, ii === 0, ii === list.length - 1)}</div>
          <div class="pe-item-grid">${def.items.map((f) => fieldHtml(f, `blocks.${bi}.items.${ii}.${f.key}`)).join('')}</div>
        </div>`).join('')}
        <button type="button" class="btn btn--ghost btn--sm" data-act="item-add" data-b="${bi}">+ Item</button>
      </div>`;
    }
    const summary = b.title || (b.items && b.items[0] && (b.items[0].label || b.items[0].title)) || '';
    return `
      <div class="pe-block">
        <div class="pe-block-head"><strong>${esc(def.label)}</strong><small>${esc(summary)}</small>${tools('block', bi, null, bi === 0, bi === total - 1)}</div>
        ${fields ? `<div class="pe-item-grid">${fields}</div>` : ''}
        ${items}
      </div>`;
  }

  function renderForm() {
    const d = state.draft;
    const blocks = (d.blocks || []).map((b, i, arr) => blockHtml(b, i, arr.length)).join('');
    const addBlock = `
      <div class="pe-add">
        <select id="peAddType" aria-label="Tipo de bloco">${Object.entries(S.BLOCKS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select>
        <button type="button" class="btn btn--sm" data-act="block-add">+ Adicionar bloco</button>
      </div>`;
    // mantém abertas as seções que a pessoa abriu
    const open = new Set($$('.pe-sec[open] > summary', $('#peForm')).map((s) => s.textContent));
    const isOpen = (t, dflt) => (open.size ? open.has(t) : dflt);
    $('#peForm').innerHTML =
      section('Cabeçalho', S.HEADER.map((f) => fieldHtml(f, f.path)).join(''), isOpen('Cabeçalho', true)) +
      section('Visual', S.THEME.map((f) => fieldHtml(f, f.path)).join(''), isOpen('Visual', false)) +
      section('Contato e redes', S.CONTACT.map((f) => fieldHtml(f, f.path)).join(''), isOpen('Contato e redes', false)) +
      section(`Blocos (${(d.blocks || []).length})`, blocks + addBlock, isOpen(`Blocos (${(d.blocks || []).length})`, true) || [...open].some((t) => t.startsWith('Blocos')));
  }

  function readInput(el) {
    switch (el.dataset.type) {
      case 'checkbox': return el.checked;
      case 'list': return el.value.split(',').map((s) => s.trim()).filter(Boolean);
      default: return el.value;
    }
  }

  $('#peForm').addEventListener('input', (e) => {
    const el = e.target.closest('[data-path]');
    if (!el) return;
    setPath(state.draft, el.dataset.path, readInput(el));
    if (el.dataset.type === 'color') el.nextElementSibling.textContent = el.value;
    if (el.dataset.path === 'name') $('#peName').textContent = el.value;
    markDirty();
  });
  $('#peForm').addEventListener('change', (e) => {
    if (e.target.matches('select[data-path], input[type=checkbox][data-path]')) e.target.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  $('#peForm').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const d = state.draft;
    d.blocks ||= [];
    const b = Number(btn.dataset.b), i = Number(btn.dataset.i);
    const block = d.blocks[b];
    switch (btn.dataset.act) {
      case 'block-add': d.blocks.push(S.newBlock($('#peAddType').value)); break;
      case 'block-up': move(d.blocks, b, -1); break;
      case 'block-down': move(d.blocks, b, 1); break;
      case 'block-del': if (!confirm(`Remover o bloco "${(S.BLOCKS[block.type] || {}).label}"?`)) return; d.blocks.splice(b, 1); break;
      case 'item-add': (block.items ||= []).push({ ...S.BLOCKS[block.type].newItem }); break;
      case 'item-up': move(block.items, i, -1); break;
      case 'item-down': move(block.items, i, 1); break;
      case 'item-del': block.items.splice(i, 1); break;
      default: return;
    }
    renderForm();
    markDirty();
  });

  // ---------- prévia ----------
  let previewTimer, previewSeq = 0;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(preview, 400);
  }
  async function preview() {
    const seq = ++previewSeq;
    const res = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(state.draft) });
    if (seq !== previewSeq) return; // chegou uma prévia mais nova
    if (res.ok) {
      $('#pePreview').srcdoc = await res.text();
      $('#pePreviewError').hidden = true;
    } else {
      const data = await res.json().catch(() => ({}));
      $('#pePreviewError').textContent = data.error || 'Não foi possível gerar a prévia.';
      $('#pePreviewError').hidden = false;
    }
  }

  // ---------- salvar / excluir ----------
  $('#peSave').addEventListener('click', async () => {
    const btn = $('#peSave');
    btn.disabled = true;
    try {
      const data = await api(`/api/pages?slug=${encodeURIComponent(state.slug)}`, { method: 'PUT', body: state.draft });
      state.draft = structuredClone(data.page);
      state.dirty = false;
      $('#peSaved').textContent = 'Salva ✓';
      renderForm();
    } catch (err) {
      $('#peSaved').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('#peDelete').addEventListener('click', async () => {
    if (!confirm(`Excluir a página /${state.slug}? O endereço deixa de funcionar.`)) return;
    await api(`/api/pages?slug=${encodeURIComponent(state.slug)}`, { method: 'DELETE' });
    state.dirty = false;
    closeEditor();
  });

  // ---------- cliques por link ----------
  function renderStats(st) {
    const max = Math.max(1, ...st.targets.map((t) => t.count));
    const rows = [...st.targets].sort((a, b) => b.count - a.count);
    $('#peStats').innerHTML = `
      <h2>Desempenho no período</h2>
      <div class="pe-kpis">
        <div><strong>${nf.format(st.views)}</strong><small>visitas</small></div>
        <div><strong>${nf.format(st.clicks)}</strong><small>cliques</small></div>
        <div><strong>${st.views ? pct(st.clicks / st.views) : '—'}</strong><small>taxa de clique</small></div>
      </div>
      ${rows.length ? rows.map((t) => `
        <div class="hbar">
          <div class="hbar-label"><span>${esc(t.label)}</span><strong>${nf.format(t.count)}</strong></div>
          <div class="hbar-track"><i style="width:${(t.count / max) * 100}%"></i></div>
        </div>`).join('') : '<p class="empty">Nenhum link nesta página.</p>'}
      <p class="card-note">Cliques contados por link desde a última vez que os blocos mudaram de posição.</p>`;
  }

  async function refreshStats() {
    const { from, to } = range();
    const data = await api(`/api/pages?slug=${encodeURIComponent(state.slug)}&from=${from}&to=${to}`);
    renderStats(data.stats);
  }

  // chamado pelo admin.js ao abrir a aba ou trocar o período
  window.FAdminPages = {
    reload() {
      const m = location.hash.match(/^#pages\/([a-z0-9-]+)$/);
      if (state.slug) refreshStats(); // trocar o período não pode descartar a edição
      else if (m) openEditor(m[1]);
      else loadList();
    },
  };
})();
