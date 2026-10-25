// Esquema da página de links: alimenta o formulário do painel e define as chaves de clique.
// Roda no navegador (window.FPageSchema) e no servidor (require).
(function (root) {
  // Campos do cabeçalho. path com ponto = objeto aninhado (theme.accent)
  const HEADER = [
    { path: 'name', label: 'Nome', type: 'text', required: true },
    { path: 'role', label: 'Profissão / especialidade', type: 'text' },
    { path: 'location', label: 'Cidade / atendimento', type: 'text' },
    { path: 'bio', label: 'Bio', type: 'textarea' },
    { path: 'badges', label: 'Credenciais (separadas por vírgula)', type: 'list', placeholder: 'CRN-3 12345, +2.000 pacientes' },
    { path: 'verified', label: 'Mostrar selo de verificado', type: 'checkbox' },
    { path: 'avatar', label: 'Foto (URL ou /img/arquivo.jpg)', type: 'url' },
    { path: 'cover.image', label: 'Capa (URL; vazio = gradiente)', type: 'url' },
  ];
  const THEME = [
    { path: 'theme.style', label: 'Tema', type: 'select', options: [['claro', 'Claro'], ['escuro', 'Escuro']] },
    { path: 'theme.accent', label: 'Cor de destaque', type: 'color' },
    { path: 'theme.font', label: 'Fonte dos títulos', type: 'select', options: [['sans', 'Sem serifa'], ['serif', 'Com serifa'], ['rounded', 'Arredondada']] },
  ];
  const CONTACT = [
    { path: 'whatsapp', label: 'WhatsApp (com DDI)', type: 'text', placeholder: '5511999999999' },
    { path: 'cta.label', label: 'Botão fixo: texto', type: 'text', placeholder: 'Agendar consulta' },
    { path: 'cta.message', label: 'Botão fixo: mensagem', type: 'text' },
    { path: 'social.instagram', label: 'Instagram', type: 'text', placeholder: '@perfil' },
    { path: 'social.youtube', label: 'YouTube', type: 'text' },
    { path: 'social.tiktok', label: 'TikTok', type: 'text' },
    { path: 'social.linkedin', label: 'LinkedIn', type: 'text' },
    { path: 'social.email', label: 'E-mail', type: 'text' },
    { path: 'footer', label: 'Rodapé', type: 'text' },
  ];

  const ICONS = ['link', 'whatsapp', 'calendar', 'chat', 'phone', 'email', 'map', 'doc', 'book', 'gift', 'cart', 'star', 'play', 'check', 'clock', 'instagram', 'youtube', 'tiktok', 'linkedin'];
  const icon = { label: 'Ícone', type: 'select', options: ICONS.map((i) => [i, i]) };
  // Destino de um botão: link ou mensagem de WhatsApp
  const target = [
    { key: 'url', label: 'Link (https://...)', type: 'url' },
    { key: 'whatsappMessage', label: 'ou mensagem de WhatsApp (se preenchida, vale no lugar do link)', type: 'text' },
  ];

  // fields: campos do bloco; items: campos de cada item da lista do bloco
  const BLOCKS = {
    highlight: {
      label: 'Destaque',
      fields: [
        { key: 'tag', label: 'Etiqueta', type: 'text' },
        { key: 'title', label: 'Título', type: 'text' },
        { key: 'text', label: 'Texto', type: 'textarea' },
        { key: 'image', label: 'Imagem (URL)', type: 'url' },
        { key: 'button.label', label: 'Botão: texto', type: 'text' },
        { key: 'button.url', label: 'Botão: link', type: 'url' },
        { key: 'button.whatsappMessage', label: 'ou mensagem de WhatsApp (vale no lugar do link)', type: 'text' },
      ],
    },
    links: {
      label: 'Lista de links',
      fields: [{ key: 'title', label: 'Título da seção', type: 'text' }],
      items: [{ key: 'icon', ...icon }, { key: 'label', label: 'Texto', type: 'text' }, { key: 'sub', label: 'Subtítulo', type: 'text' }, ...target],
      newItem: { icon: 'whatsapp', label: 'Novo link', whatsappMessage: 'Olá! Vim pela sua página.' },
    },
    grid: {
      label: 'Vitrine',
      fields: [{ key: 'title', label: 'Título da seção', type: 'text' }],
      items: [{ key: 'title', label: 'Nome', type: 'text' }, { key: 'price', label: 'Preço / detalhe', type: 'text' }, { key: 'image', label: 'Imagem (URL)', type: 'url' }, { key: 'icon', ...icon }, ...target],
      newItem: { title: 'Novo item', icon: 'star' },
    },
    video: {
      label: 'Vídeo do YouTube',
      fields: [{ key: 'title', label: 'Título', type: 'text' }, { key: 'youtube', label: 'Id do vídeo (11 caracteres)', type: 'text', placeholder: 'dQw4w9WgXcQ' }],
    },
    testimonials: {
      label: 'Depoimentos',
      fields: [{ key: 'title', label: 'Título da seção', type: 'text' }],
      items: [{ key: 'text', label: 'Depoimento', type: 'textarea' }, { key: 'author', label: 'Autor', type: 'text' }],
      newItem: { text: 'Depoimento', author: 'Nome' },
    },
    location: {
      label: 'Endereço',
      fields: [{ key: 'title', label: 'Título da seção', type: 'text' }, { key: 'address', label: 'Endereço', type: 'text' }, { key: 'hours', label: 'Horário', type: 'text' }, { key: 'mapsUrl', label: 'Link do mapa (opcional)', type: 'url' }],
    },
    faq: {
      label: 'Perguntas',
      fields: [{ key: 'title', label: 'Título da seção', type: 'text' }],
      items: [{ key: 'q', label: 'Pergunta', type: 'text' }, { key: 'a', label: 'Resposta', type: 'textarea' }],
      newItem: { q: 'Pergunta', a: 'Resposta' },
    },
    stats: {
      label: 'Números',
      fields: [],
      items: [{ key: 'value', label: 'Valor', type: 'text' }, { key: 'label', label: 'Legenda', type: 'text' }],
      newItem: { value: '10', label: 'anos' },
    },
  };

  // Conteúdo inicial de um bloco novo
  function newBlock(type) {
    const def = BLOCKS[type];
    const b = { type };
    if (type === 'highlight') Object.assign(b, { title: 'Sua oferta principal', text: 'Descreva em uma frase.', button: { label: 'Quero saber mais', whatsappMessage: 'Olá! Quero saber mais.' } });
    if (type === 'location') b.address = 'Endereço';
    if (type === 'video') b.youtube = '';
    if (def.items) b.items = [{ ...def.newItem }];
    return b;
  }

  function newPage(slug, name) {
    return {
      slug,
      name,
      role: '',
      theme: { style: 'claro', accent: '#0066ff', font: 'sans' },
      cta: { label: 'Falar no WhatsApp', message: 'Olá! Vim pela sua página.' },
      blocks: [newBlock('links')],
    };
  }

  // Chaves de clique: as mesmas que o renderizador põe em data-k. Devolve [{ key, label }]
  function clickTargets(page) {
    const out = [];
    if (page.cta) out.push({ key: 'cta', label: `Botão fixo: ${page.cta.label || 'WhatsApp'}` });
    for (const k of Object.keys(page.social || {})) if (page.social[k]) out.push({ key: `s-${k}`, label: `Rede: ${k}` });
    (page.blocks || []).forEach((b, i) => {
      const name = (BLOCKS[b.type] || { label: b.type }).label;
      if (b.type === 'highlight' && b.button) out.push({ key: `b${i}`, label: `${name}: ${b.button.label || b.title || ''}` });
      if (b.type === 'video' || b.type === 'location') out.push({ key: `b${i}`, label: `${name}${b.title ? `: ${b.title}` : ''}` });
      if (b.type === 'links' || b.type === 'grid') {
        (b.items || []).forEach((it, j) => out.push({ key: `b${i}-${j}`, label: it.label || it.title || `Item ${j + 1}` }));
      }
    });
    return out;
  }

  // Tira strings vazias e objetos vazios (o formulário deixa campos em branco)
  function clean(v) {
    if (Array.isArray(v)) return v.map(clean).filter((x) => x !== undefined);
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) {
        const c = clean(x);
        if (c !== undefined) o[k] = c;
      }
      return Object.keys(o).length ? o : undefined;
    }
    if (typeof v === 'string') return v.trim() === '' ? undefined : v;
    return v;
  }

  const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  const api = { HEADER, THEME, CONTACT, BLOCKS, ICONS, newBlock, newPage, clickTargets, clean, SLUG };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FPageSchema = api;
})(typeof self !== 'undefined' ? self : this);
