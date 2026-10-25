// Funil: perguntas de múltipla escolha, contato só para quem se qualifica e tela de aprovado com WhatsApp.

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const quiz = JSON.parse($('#quizData').textContent);
  const form = $('#funnel');
  const steps = $$('.step', form);
  const bar = $('#bar');
  const nextBtn = $('#next');
  const backBtn = $('#back');
  const errorBox = $('#formError');
  const ddiSelect = $('#ddi');
  const questionIds = quiz.questions.map((q) => q.id);
  const otherQ = quiz.questions.find((q) => q.otherField);

  const answers = {};
  const startedAt = Date.now();
  let current = 0;
  let busy = false;

  const session = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Erro inesperado'), { status: res.status, data });
    return data;
  }
  let configPromise;
  const config = () => (configPromise ||= api('/api/config').catch(() => ({})));

  // Guarda UTMs/fbclid da chegada: o lead leva junto qual anúncio o trouxe
  const params = new URLSearchParams(location.search);
  const utm = session.get('f_utm') || {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']) {
    if (params.get(k)) utm[k] = params.get(k);
  }
  session.set('f_utm', utm);
  utm.tema = document.documentElement.dataset.tema;

  // Teste A/B: conta uma visita por tema e por sessão (o lead leva o mesmo tema em utm.tema)
  if (session.get('f_visit') !== utm.tema) {
    const body = JSON.stringify({ tema: utm.tema });
    const sent = navigator.sendBeacon?.('/api/visit', new Blob([body], { type: 'application/json' }));
    if (!sent) fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    session.set('f_visit', utm.tema);
  }

  // ---------- país do WhatsApp: começa pelo idioma do navegador, Brasil por padrão ----------
  ddiSelect.innerHTML = FPhone.COUNTRIES.map((c) => `<option value="${c.ddi}">${c.flag} ${c.name} (+${c.ddi})</option>`).join('');
  const region = (navigator.language || '').split('-')[1]?.toUpperCase();
  const guess = FPhone.COUNTRIES.find((c) => c.iso === region && region !== 'US' && region !== 'GB');
  ddiSelect.value = guess ? guess.ddi : '55';
  function syncDdi() {
    const c = FPhone.COUNTRIES.find((x) => x.ddi === ddiSelect.value);
    $('#ddiLabel').textContent = `${c.flag} +${c.ddi}`;
    const input = form.elements.whatsapp;
    input.placeholder = c.example;
    input.value = FPhone.format(c.ddi, input.value);
    input.closest('.field').classList.remove('invalid');
    refresh();
  }
  ddiSelect.addEventListener('change', syncDdi);

  // ---------- navegação ----------
  const stepName = () => steps[current].dataset.step;
  const val = (name) => (form.elements[name]?.value || '').trim();
  const cleanIg = (s) => s.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#\s]/)[0];
  const otherChosen = () => otherQ && answers[otherQ.id] === otherQ.otherField.value;

  function showError(msg) {
    errorBox.textContent = msg || '';
    errorBox.hidden = !msg;
  }

  function go(i, { scroll = true } = {}) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, idx) => s.classList.toggle('active', idx === current));
    const name = stepName();
    bar.style.transform = `scaleX(${(current + 1) / (steps.length - 1)})`; // escala, não largura: não recalcula layout
    bar.parentElement.hidden = name === 'aprovado';
    backBtn.style.visibility = current === 0 || name === 'aprovado' ? 'hidden' : 'visible';
    nextBtn.textContent = name === 'contato' ? 'Ver meu resultado' : 'Continuar';
    showError('');
    refresh();
    if (scroll && current > 0) {
      const first = $('input', steps[current]);
      if (first && matchMedia('(min-width: 721px)').matches) setTimeout(() => first.focus({ preventScroll: true }), 50);
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function stepValid(mark = false) {
    const name = stepName();
    const setInvalid = (field, bad) => {
      if (mark) form.elements[field].closest('.field').classList.toggle('invalid', bad);
      return !bad;
    };
    if (questionIds.includes(name)) {
      if (!answers[name]) return false;
      if (otherQ && name === otherQ.id && otherChosen()) return setInvalid('areaOutro', val('areaOutro').length < 2);
      return true;
    }
    if (name === 'contato') {
      const a = setInvalid('nome', val('nome').length < 2);
      const b = setInvalid('instagram', cleanIg(val('instagram')).length < 2);
      const phone = FPhone.validate(ddiSelect.value, val('whatsapp'));
      if (mark) $('#whatsappErr').textContent = phone.error || '';
      const c = setInvalid('whatsapp', !phone.ok);
      return a && b && c;
    }
    return true;
  }

  function refresh() {
    const name = stepName();
    // múltipla escolha avança sozinha: o botão só aparece onde precisa digitar
    const needsButton = name === 'contato' || (otherQ && name === otherQ.id && otherChosen());
    nextBtn.hidden = !needsButton;
    nextBtn.disabled = busy || (name !== 'contato' && !stepValid());
    $('.nav', form).hidden = name === 'aprovado' || (current === 0 && !needsButton);
  }

  // Título de uma pergunta pode depender de uma resposta anterior (titleBy no config)
  function adaptTitles() {
    for (const q of quiz.questions) {
      if (!q.titleBy) continue;
      const [dep, map] = Object.entries(q.titleBy)[0];
      $(`.step[data-step="${q.id}"] h2`).textContent = map[answers[dep]] || q.title;
    }
  }

  $$('.options', form).forEach((group) => {
    const name = group.dataset.name;
    group.addEventListener('click', (e) => {
      const opt = e.target.closest('.option');
      if (!opt) return;
      $$('.option', group).forEach((o) => o.classList.toggle('selected', o === opt));
      answers[name] = opt.dataset.value;
      if (otherQ && name === otherQ.id) {
        const field = $('.other-field', group.parentElement);
        field.hidden = !otherChosen();
        if (otherChosen()) $('#areaOutro').focus();
      }
      adaptTitles();
      refresh();
      if (!(otherQ && name === otherQ.id && otherChosen())) setTimeout(() => stepValid() && next(), 260);
    });
  });

  form.addEventListener('input', (e) => {
    if (e.target.name === 'whatsapp') e.target.value = FPhone.format(ddiSelect.value, e.target.value);
    e.target.closest('.field')?.classList.remove('invalid');
    refresh();
  });

  // Atalhos: letras escolhem opção, Enter avança
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!form.contains(document.activeElement) && document.activeElement !== document.body) return;
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
      e.preventDefault();
      if (!nextBtn.hidden && !nextBtn.disabled) next();
      return;
    }
    if (e.target.matches('input, select, textarea')) return;
    const idx = 'abcdefghij'.indexOf(e.key.toLowerCase());
    const opts = $$('.options .option', steps[current]);
    if (idx >= 0 && opts[idx]) opts[idx].click();
  });

  backBtn.addEventListener('click', () => go(current - 1));
  nextBtn.addEventListener('click', () => next());
  form.addEventListener('submit', (e) => e.preventDefault());

  function next() {
    if (busy || !stepValid(true)) return;
    const name = stepName();
    if (name === 'contato') return submitLead();
    // última pergunta e não se qualifica: envia sem pedir contato
    if (steps[current + 1]?.dataset.step === 'contato' && FQualify.outcome(quiz, answers) !== 'qualified') return submitLead();
    go(current + 1);
  }

  function setBusy(on, label) {
    busy = on;
    if (label) nextBtn.textContent = label;
    refresh();
  }

  function areaLabel() {
    if (!otherQ) return '';
    if (otherChosen()) return val('areaOutro');
    const opt = otherQ.options.find((o) => o.value === answers[otherQ.id]);
    return opt ? opt.label.split('(')[0].trim() : '';
  }

  async function submitLead() {
    const qualifies = FQualify.outcome(quiz, answers) === 'qualified';
    setBusy(true, 'Analisando seu perfil…');
    const contact = qualifies ? { nome: val('nome'), instagram: cleanIg(val('instagram')), ddi: ddiSelect.value, whatsapp: val('whatsapp') } : {};
    try {
      const res = await api('/api/leads', {
        method: 'POST',
        body: { ...answers, areaOutro: val('areaOutro'), ...contact, elapsedMs: Date.now() - startedAt, website: val('website'), utm },
      });
      if (res.status !== 'qualified') {
        location.href = res.status === 'downsell' ? '/downsell' : '/material';
        return;
      }
      const lead = { leadId: res.leadId, token: res.token, code: res.code, nome: val('nome'), area: areaLabel() };
      session.set('f_lead', lead);
      busy = false;
      openApproved(lead);
    } catch (err) {
      setBusy(false);
      const fields = err.data?.fields || [];
      // resposta recusada: volta para a pergunta certa em vez de um erro genérico
      const badQ = questionIds.find((id) => fields.includes(id)) || (fields.includes('area') && otherQ?.id);
      if (badQ) {
        go(steps.findIndex((s) => s.dataset.step === badQ));
        showError('Não conseguimos registrar esta resposta. Escolha de novo.');
        return;
      }
      go(current, { scroll: false });
      for (const f of ['nome', 'instagram', 'whatsapp']) if (fields.includes(f)) form.elements[f].closest('.field').classList.add('invalid');
      showError(err.status === 429 || fields.length ? err.message : 'Algo deu errado. Tente novamente em instantes.');
    }
  }

  // ---------- aprovado: "ingresso" com o código e o botão do WhatsApp ----------
  function bars(code) {
    // código de barras desenhado a partir do código do lead (sempre igual para o mesmo código)
    let x = 0, out = '';
    for (const ch of (code || 'XX').repeat(4)) {
      const n = ch.charCodeAt(0);
      for (const w of [1 + (n % 3), 1 + ((n >> 2) % 2), 1 + ((n >> 3) % 3)]) {
        if (x + w > 120) break;
        out += `<rect x="${x}" y="0" width="${w}" height="28" fill="currentColor"/>`;
        x += w + 1 + ((n >> 1) % 2);
      }
    }
    $('#tkBars').innerHTML = out;
  }

  async function openApproved(lead) {
    const first = (lead.nome || '').split(/\s+/).find((w) => w && !/^dr(a)?\.?$/i.test(w));
    $('#okName').textContent = first ? `, ${first}` : '';
    $('#tkName').textContent = (lead.nome || '').split(/\s+/).filter((w) => !/^dr(a)?\.?$/i.test(w)).slice(0, 2).join(' ') || '—';
    $('#tkArea').textContent = lead.area || '—';
    $('#tkCode').textContent = lead.code;
    bars(lead.code);
    go(steps.findIndex((s) => s.dataset.step === 'aprovado'));

    const cfg = await config();
    if (!cfg.whatsapp) { $('#waGo').hidden = true; $('#waNote').hidden = true; return; }
    // o código na mensagem liga a conversa ao cadastro (e ao anúncio de origem)
    const msg = String(cfg.whatsappMessage || '')
      .replace('{brand}', cfg.brand || '')
      .replace('{nameSentence}', first ? ` Sou ${first}.` : '')
      .replace('{code}', lead.code);
    $('#waGo').href = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`;
  }

  $('#waGo').addEventListener('click', () => {
    const lead = session.get('f_lead');
    if (!lead) return;
    // não segura a ida ao WhatsApp: registra em segundo plano (keepalive sobrevive à troca de página)
    fetch('/api/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.leadId, token: lead.token }), keepalive: true }).catch(() => {});
  });

  // Quem já foi aprovado nesta sessão volta direto para o ingresso
  syncDdi();
  const saved = session.get('f_lead');
  if (saved) openApproved(saved);
  else go(0, { scroll: false });
})();
