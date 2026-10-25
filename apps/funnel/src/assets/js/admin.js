// Painel: login, visão geral (números do período) e lista de leads com detalhe, etapa e anotações.
// Tudo que veio do visitante passa por esc() antes de entrar no HTML.

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const quiz = JSON.parse($('#quizData').textContent);
  const STAGES = { novo: 'Novo', contatado: 'Contatado', negociando: 'Negociando', fechado: 'Fechado', perdido: 'Perdido' };
  const STATUS = { qualified: 'Qualificado', downsell: 'Downsell', material: 'Material' };
  const PAGE = 50;

  const state = { view: 'overview', offset: 0, total: 0, lead: null };

  // ---------- API: 401 em qualquer chamada volta para o login ----------
  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith('/api/session')) { showLogin(); throw new Error('Sessão expirada'); }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Erro inesperado'), { status: res.status });
    return data;
  }

  // ---------- formatação ----------
  const nf = new Intl.NumberFormat('pt-BR');
  const pct = (v) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
  const dt = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const optLabel = (q, v) => (q.options.find((o) => o.value === v) || {}).label || v || '—';
  const areaOf = (l) => {
    const q = quiz.questions.find((x) => x.otherField);
    if (!q) return '';
    return l.areaOutro || optLabel(q, l.answers?.[q.id]).split('(')[0].trim();
  };
  const badge = (status) => `<span class="badge badge--${esc(status)}">${esc(STATUS[status] || status)}</span>`;
  const stageBadge = (stage) => `<span class="badge badge--stage-${esc(stage)}">${esc(STAGES[stage] || stage)}</span>`;

  // ---------- login ----------
  function showLogin(msg) {
    $('#app').hidden = true;
    $('#login').hidden = false;
    if (msg) $('#loginSub').textContent = msg;
    setTimeout(() => $('#password').focus(), 50);
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    $('#loginError').hidden = true;
    try {
      await api('/api/session', { method: 'POST', body: { password: $('#password').value } });
      $('#password').value = '';
      startApp();
    } catch (err) {
      $('#loginError').textContent = err.message;
      $('#loginError').hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/api/session', { method: 'DELETE' }).catch(() => {});
    showLogin();
  });

  $('#themeBtn').addEventListener('click', () => {
    const t = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
    document.documentElement.dataset.tema = t;
    try { localStorage.setItem('f_admin_tema', t); } catch {}
  });

  // ---------- período ----------
  const range = () => ({ from: $('#from').value, to: $('#to').value });
  function setRange(days) {
    $('#to').value = today();
    $('#from').value = addDays(today(), -(days - 1));
    $$('.chip[data-range]').forEach((c) => c.classList.toggle('active', Number(c.dataset.range) === days));
  }
  $$('.chip[data-range]').forEach((c) => c.addEventListener('click', () => { setRange(Number(c.dataset.range)); reload(); }));
  for (const id of ['from', 'to']) $('#' + id).addEventListener('change', () => { $$('.chip[data-range]').forEach((c) => c.classList.remove('active')); reload(); });

  // ---------- abas ----------
  function setView(view) {
    state.view = view;
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === view)));
    $('#view-overview').hidden = view !== 'overview';
    $('#view-leads').hidden = view !== 'leads';
    history.replaceState(null, '', view === 'leads' ? '#leads' : '#');
    reload();
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));

  function reload() {
    if (state.view === 'overview') loadOverview();
    else { state.offset = 0; loadLeads(); }
  }

  // ---------- visão geral ----------
  function bars(rows, total) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return rows.map((r) => `
      <div class="hbar">
        <div class="hbar-label"><span>${esc(r.label)}</span><strong>${nf.format(r.value)}${total ? ` <small>${pct(r.value / total)}</small>` : ''}</strong></div>
        <div class="hbar-track"><i style="width:${(r.value / max) * 100}%"${r.color ? ` class="${r.color}"` : ''}></i></div>
      </div>`).join('');
  }

  function dailyChart(daily, from, to) {
    const map = new Map(daily.map((d) => [d.day, d]));
    const days = [];
    for (let d = from; d <= to && days.length < 400; d = addDays(d, 1)) days.push(map.get(d) || { day: d, leads: 0, qualified: 0 });
    const max = Math.max(1, ...days.map((d) => d.leads));
    return `<div class="chart-bars">${days.map((d) => `
      <div class="col" title="${esc(d.day.split('-').reverse().join('/'))}: ${d.leads} respostas, ${d.qualified} qualificados${d.visits != null ? `, ${d.visits} visitas` : ''}">
        <i class="col-leads" style="height:${(d.leads / max) * 100}%"></i>
        <i class="col-qual" style="height:${(d.qualified / max) * 100}%"></i>
      </div>`).join('')}</div>
      <div class="chart-axis"><span>${esc(from.split('-').reverse().slice(0, 2).join('/'))}</span><span>${esc(to.split('-').reverse().slice(0, 2).join('/'))}</span></div>`;
  }

  async function loadOverview() {
    const { from, to } = range();
    const s = await api(`/api/stats?from=${from}&to=${to}`);
    const t = s.totals;
    const kpi = (label, value, sub) => `<div class="kpi"><p>${esc(label)}</p><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
    $('#kpis').innerHTML = [
      kpi('Visitas', nf.format(t.visits)),
      kpi('Responderam o quiz', nf.format(t.leads), `${pct(t.quizRate)} das visitas`),
      kpi('Qualificados', nf.format(t.qualified), `${pct(t.qualifiedRate)} das respostas`),
      kpi('Clicaram no WhatsApp', nf.format(t.whatsappClicks), `${pct(t.clickRate)} dos qualificados`),
      kpi('Fechados', nf.format(t.closed)),
    ].join('');

    $('#chartDaily').innerHTML = dailyChart(s.daily, s.from, s.to);
    $('#funnelBars').innerHTML = bars([
      { label: 'Visitas', value: t.visits },
      { label: 'Responderam', value: t.leads },
      { label: 'Qualificados', value: t.qualified, color: 'ok' },
      { label: 'Clicaram no WhatsApp', value: t.whatsappClicks, color: 'wa' },
    ]) + bars([
      { label: 'Foram para o downsell', value: s.status.downsell || 0, color: 'muted' },
      { label: 'Foram para o material', value: s.status.material || 0, color: 'muted' },
    ]);
    $('#stageBars').innerHTML = t.qualified
      ? bars(Object.keys(STAGES).map((k) => ({ label: STAGES[k], value: s.stages[k] || 0, color: k === 'fechado' ? 'ok' : k === 'perdido' ? 'muted' : '' })), t.qualified)
      : '<p class="empty">Nenhum qualificado no período.</p>';

    $('#sources').innerHTML = s.sources.length
      ? `<thead><tr><th>Origem</th><th>Respostas</th><th>Qualif.</th><th>Taxa</th></tr></thead><tbody>${s.sources.map((r) => `
          <tr><td>${esc(r.source)}</td><td>${nf.format(r.leads)}</td><td>${nf.format(r.qualified)}</td><td>${pct(r.qualified / r.leads)}</td></tr>`).join('')}</tbody>`
      : '<tbody><tr><td class="empty">Sem dados no período.</td></tr></tbody>';

    const best = s.ab.reduce((a, b) => ((b.conversion || 0) > (a.conversion || 0) ? b : a), s.ab[0]);
    $('#abTable').innerHTML = `<thead><tr><th>Tema</th><th>Visitas</th><th>Qualif.</th><th>Conversão</th></tr></thead><tbody>${s.ab.map((r) => `
      <tr${r === best && r.conversion ? ' class="win"' : ''}><td>${r.tema === 'claro' ? 'Claro' : 'Escuro'}</td><td>${nf.format(r.visits)}</td><td>${nf.format(r.qualified)}</td><td>${pct(r.conversion)}</td></tr>`).join('')}</tbody>`;

    $('#answers').innerHTML = s.answers.map((q) => {
      const total = q.options.reduce((a, o) => a + o.count, 0);
      return `<div class="answer"><h3>${esc(q.title)}</h3>${bars(q.options.map((o) => ({ label: o.label, value: o.count })), total)}</div>`;
    }).join('');
  }

  // ---------- leads ----------
  function leadQuery(extra = {}) {
    const p = new URLSearchParams({ ...range(), ...extra });
    if ($('#q').value.trim()) p.set('q', $('#q').value.trim());
    if ($('#fStatus').value) p.set('status', $('#fStatus').value);
    if ($('#fStage').value) p.set('stage', $('#fStage').value);
    return p;
  }

  async function loadLeads() {
    const p = leadQuery({ limit: PAGE, offset: state.offset });
    $('#exportBtn').href = `/api/export?${leadQuery()}`;
    const { leads, total } = await api(`/api/leads?${p}`);
    state.total = total;
    $('#leadsTable tbody').innerHTML = leads.map((l) => `
      <tr data-id="${esc(l.id)}" tabindex="0">
        <td class="nowrap">${esc(dt(l.createdAt))}</td>
        <td><strong>${esc(l.nome || '—')}</strong><small>${l.instagram ? '@' + esc(l.instagram) : esc(l.code)}</small></td>
        <td>${badge(l.status)}</td>
        <td>${l.status === 'qualified' ? stageBadge(l.stage || 'novo') : '—'}</td>
        <td>${esc(areaOf(l))}</td>
        <td>${esc(l.utm?.utm_source || 'direto')}</td>
        <td>${l.whatsappClickedAt ? '<span class="dot dot--ok" title="Clicou no WhatsApp"></span>' : ''}</td>
      </tr>`).join('');
    $('#leadsEmpty').hidden = leads.length > 0;
    const end = Math.min(state.offset + PAGE, total);
    $('#pagerInfo').textContent = total ? `${state.offset + 1}–${end} de ${nf.format(total)}` : '';
    $('#prevPage').disabled = state.offset === 0;
    $('#nextPage').disabled = end >= total;
  }

  let searchTimer;
  $('#q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.offset = 0; loadLeads(); }, 300); });
  for (const id of ['fStatus', 'fStage']) $('#' + id).addEventListener('change', () => { state.offset = 0; loadLeads(); });
  $('#prevPage').addEventListener('click', () => { state.offset = Math.max(0, state.offset - PAGE); loadLeads(); });
  $('#nextPage').addEventListener('click', () => { state.offset += PAGE; loadLeads(); });

  const stageOptions = Object.entries(STAGES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#fStage').insertAdjacentHTML('beforeend', stageOptions);
  $('#dStage').innerHTML = stageOptions;

  const tbody = $('#leadsTable tbody');
  tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openLead(tr.dataset.id); });
  tbody.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openLead(tr.dataset.id); } });

  // ---------- detalhe ----------
  let lastFocus = null;
  async function openLead(id) {
    lastFocus = document.activeElement;
    const l = await api(`/api/lead?id=${encodeURIComponent(id)}`);
    state.lead = l;
    $('#dCode').textContent = `${l.code} · ${STATUS[l.status] || l.status}`;
    $('#dName').textContent = l.nome || 'Sem contato (não qualificado)';

    const actions = [];
    if (l.whatsapp) actions.push(`<a class="btn btn--wa btn--sm" href="https://wa.me/${esc(l.whatsapp)}" target="_blank" rel="noopener">Abrir WhatsApp</a>`);
    if (l.instagram) actions.push(`<a class="btn btn--ghost btn--sm" href="https://instagram.com/${encodeURIComponent(l.instagram)}" target="_blank" rel="noopener">Ver Instagram</a>`);
    $('#dActions').innerHTML = actions.join('');
    $('#dActions').hidden = !actions.length;

    const fact = (k, v) => (v ? `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>` : '');
    $('#dFacts').innerHTML = [
      fact('Recebido em', dt(l.createdAt)),
      fact('WhatsApp', l.whatsapp ? `+${l.whatsapp}` : ''),
      fact('Instagram', l.instagram ? `@${l.instagram}` : ''),
      fact('Clicou no WhatsApp', l.whatsappClickedAt ? dt(l.whatsappClickedAt) : (l.status === 'qualified' ? 'Ainda não' : '')),
      fact('Origem', [l.utm?.utm_source, l.utm?.utm_medium, l.utm?.utm_campaign].filter(Boolean).join(' / ') || 'direto'),
      fact('Anúncio', l.utm?.utm_content),
      fact('Tema visto', l.utm?.tema),
      fact('Tempo no quiz', l.elapsedMs ? `${Math.round(l.elapsedMs / 1000)}s` : ''),
    ].join('');
    $('#dAnswers').innerHTML = quiz.questions.map((q) => fact(q.title, optLabel(q, l.answers?.[q.id]))).join('') + fact('Profissão', l.areaOutro);

    $('#dStage').value = l.stage || 'novo';
    $('#dStage').disabled = l.status !== 'qualified';
    $('#dNotes').value = l.notes || '';
    $('#dSaved').textContent = l.updatedAt ? `Atualizado ${dt(l.updatedAt)}` : '';
    $('#drawer').hidden = $('#drawerBg').hidden = false;
    $('#drawerClose').focus();
  }

  function closeDrawer() {
    $('#drawer').hidden = $('#drawerBg').hidden = true;
    state.lead = null;
    lastFocus?.focus?.();
  }
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerBg').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

  $('#dSave').addEventListener('click', async () => {
    if (!state.lead) return;
    const btn = $('#dSave');
    btn.disabled = true;
    try {
      const body = { notes: $('#dNotes').value };
      if (state.lead.status === 'qualified') body.stage = $('#dStage').value;
      const l = await api(`/api/lead?id=${encodeURIComponent(state.lead.id)}`, { method: 'PATCH', body });
      state.lead = l;
      $('#dSaved').textContent = 'Salvo ✓';
      loadLeads();
    } catch (err) {
      $('#dSaved').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- início ----------
  function startApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    if (!$('#from').value) setRange(30);
    setView(location.hash === '#leads' ? 'leads' : 'overview');
  }

  api('/api/session').then((s) => {
    $('#demoBar').hidden = !s.demo;
    if (s.authenticated) startApp();
    else showLogin(s.configured ? null : 'Painel sem senha: defina ADMIN_PASSWORD nas variáveis de ambiente e reinicie.');
  }).catch(() => showLogin('Não foi possível falar com o servidor.'));
})();
