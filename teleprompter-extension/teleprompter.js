const els = {
  app: document.getElementById('app'),
  counter: document.getElementById('counter'),
  title: document.getElementById('title'),
  content: document.getElementById('content'),
};
let state = { slides: [], index: 0, fontSize: 18 };

function render() {
  const { slides, index, fontSize } = state;
  els.app.style.setProperty('--fs', `${fontSize}px`);
  if (!slides.length) {
    els.counter.textContent = '0/0';
    els.title.textContent = '';
    els.content.innerHTML = '<p class="empty">Sem conteúdo. Abra o popup da extensão e envie.</p>';
    return;
  }
  const s = slides[index];
  els.counter.textContent = `${index + 1}/${slides.length}`;
  els.title.textContent = `Slide ${s.n}${s.title ? ' — ' + s.title : ''}`;
  els.content.innerHTML = TP.renderBody(s.body);
  els.content.scrollTop = 0;
}

function go(delta) {
  const next = Math.max(0, Math.min(state.slides.length - 1, state.index + delta));
  if (next !== state.index) chrome.storage.local.set({ index: next });
}

function setFont(delta) {
  const fontSize = Math.max(10, Math.min(48, state.fontSize + delta));
  chrome.storage.local.set({ fontSize });
}

function bindInput(win) {
  win.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1); }
    else if (e.key === '+' || e.key === '=') setFont(2);
    else if (e.key === '-') setFont(-2);
  });
}

els.content.addEventListener('click', () => {
  if (String(window.getSelection()).length) return;
  go(1);
});
els.content.addEventListener('contextmenu', (e) => { e.preventDefault(); go(-1); });
document.getElementById('next').addEventListener('click', () => go(1));
document.getElementById('prev').addEventListener('click', () => go(-1));
document.getElementById('bigger').addEventListener('click', () => setFont(2));
document.getElementById('smaller').addEventListener('click', () => setFont(-2));
bindInput(window);

// Picture-in-Picture: janela sempre no topo, fora da captura de aba/janela.
document.getElementById('pip').addEventListener('click', async () => {
  if (!('documentPictureInPicture' in window)) return alert('Chrome sem Document PiP (precisa v116+).');
  const pip = await documentPictureInPicture.requestWindow({ width: 400, height: 240 });
  const link = pip.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('teleprompter.css', location.href).href;
  pip.document.head.append(link);
  pip.document.body.append(els.app);
  bindInput(pip);
  pip.addEventListener('pagehide', () => document.body.append(els.app));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const k of ['slides', 'index', 'fontSize']) if (changes[k]) state[k] = changes[k].newValue;
  if (changes.index && state.index > Math.max(0, state.slides.length - 1)) state.index = 0;
  render();
});

chrome.storage.local.get(['slides', 'index', 'fontSize']).then((v) => {
  state = { slides: v.slides || [], index: v.index || 0, fontSize: v.fontSize || 18 };
  render();
});
