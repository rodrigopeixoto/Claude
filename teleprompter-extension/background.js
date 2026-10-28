const W = 400;
const H = 240;

async function openTeleprompter() {
  const { winId } = await chrome.storage.session.get('winId');
  if (winId) {
    try {
      await chrome.windows.update(winId, { focused: true });
      return;
    } catch (_) {
      /* janela fechada, cria nova */
    }
  }

  const [displays, cur] = await Promise.all([
    chrome.system.display.getInfo(),
    chrome.windows.getLastFocused(),
  ]);
  const cx = (cur.left ?? 0) + (cur.width ?? 0) / 2;
  const disp =
    displays.find((d) => cx >= d.bounds.left && cx < d.bounds.left + d.bounds.width) ||
    displays.find((d) => d.isPrimary) ||
    displays[0];
  const left = Math.round(disp.bounds.left + (disp.bounds.width - W) / 2);
  const top = disp.bounds.top;

  const win = await chrome.windows.create({
    url: 'teleprompter.html',
    type: 'popup',
    width: W,
    height: H,
    left,
    top,
    focused: true,
  });
  // Chrome às vezes ignora left/top no create
  await chrome.windows.update(win.id, { left, top, width: W, height: H });
  await chrome.storage.session.set({ winId: win.id });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'open') openTeleprompter();
});

chrome.windows.onRemoved.addListener(async (id) => {
  const { winId } = await chrome.storage.session.get('winId');
  if (winId === id) await chrome.storage.session.remove('winId');
});

chrome.commands.onCommand.addListener(async (cmd) => {
  const delta = cmd === 'next-slide' ? 1 : cmd === 'prev-slide' ? -1 : 0;
  if (!delta) return;
  const { slides = [], index = 0 } = await chrome.storage.local.get(['slides', 'index']);
  if (!slides.length) return;
  const next = Math.max(0, Math.min(slides.length - 1, index + delta));
  if (next !== index) await chrome.storage.local.set({ index: next });
});
