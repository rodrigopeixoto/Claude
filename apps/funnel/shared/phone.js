// Validação de WhatsApp com DDI. Roda no navegador (window.FPhone) e no servidor (require).
// Não prova que o número é da pessoa, mas recusa números que não podem existir.
(function (root) {
  // len: dígitos do número nacional (sem DDI) [mín, máx]; mobile: como começa um celular nesse país
  const COUNTRIES = [
    { iso: 'BR', ddi: '55', name: 'Brasil', flag: '🇧🇷', len: [11, 11], mobile: /^[1-9]{2}9/, example: '(11) 99999-9999' },
    { iso: 'PT', ddi: '351', name: 'Portugal', flag: '🇵🇹', len: [9, 9], mobile: /^9/, example: '912 345 678' },
    { iso: 'US', ddi: '1', name: 'Estados Unidos / Canadá', flag: '🇺🇸', len: [10, 10], mobile: /^[2-9]\d{2}[2-9]/, example: '201 555 0123' },
    { iso: 'AR', ddi: '54', name: 'Argentina', flag: '🇦🇷', len: [10, 11], example: '9 11 2345 6789' },
    { iso: 'UY', ddi: '598', name: 'Uruguai', flag: '🇺🇾', len: [8, 8], mobile: /^9/, example: '94 231 234' },
    { iso: 'PY', ddi: '595', name: 'Paraguai', flag: '🇵🇾', len: [9, 9], mobile: /^9/, example: '961 456 789' },
    { iso: 'CL', ddi: '56', name: 'Chile', flag: '🇨🇱', len: [9, 9], mobile: /^9/, example: '9 6123 4567' },
    { iso: 'CO', ddi: '57', name: 'Colômbia', flag: '🇨🇴', len: [10, 10], mobile: /^3/, example: '321 123 4567' },
    { iso: 'MX', ddi: '52', name: 'México', flag: '🇲🇽', len: [10, 10], example: '55 1234 5678' },
    { iso: 'ES', ddi: '34', name: 'Espanha', flag: '🇪🇸', len: [9, 9], mobile: /^[67]/, example: '612 345 678' },
    { iso: 'GB', ddi: '44', name: 'Reino Unido', flag: '🇬🇧', len: [10, 10], mobile: /^7/, example: '7400 123456' },
    { iso: 'IT', ddi: '39', name: 'Itália', flag: '🇮🇹', len: [9, 10], mobile: /^3/, example: '312 345 6789' },
    { iso: 'FR', ddi: '33', name: 'França', flag: '🇫🇷', len: [9, 9], mobile: /^[67]/, example: '6 12 34 56 78' },
    { iso: 'DE', ddi: '49', name: 'Alemanha', flag: '🇩🇪', len: [10, 11], mobile: /^1[5-7]/, example: '151 23456789' },
    { iso: 'JP', ddi: '81', name: 'Japão', flag: '🇯🇵', len: [10, 10], mobile: /^[789]0/, example: '90 1234 5678' },
  ];

  const byDdi = (ddi) => COUNTRIES.find((c) => c.ddi === String(ddi));
  const digits = (s) => String(s || '').replace(/\D/g, '');

  // Máscara de digitação. Só o Brasil ganha (11) 99999-9999; os outros ficam em blocos de 3
  function format(ddi, value) {
    const d = digits(value).slice(0, (byDdi(ddi) || { len: [0, 15] }).len[1]);
    if (ddi === '55') {
      if (d.length <= 2) return d.length ? `(${d}` : '';
      if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    return d.replace(/(\d{3})(?=\d)/g, '$1 ');
  }

  function validate(ddi, value) {
    const c = byDdi(ddi);
    if (!c) return { ok: false, error: 'Escolha o país.' };
    const d = digits(value);
    if (!d) return { ok: false, error: 'Informe o seu WhatsApp.' };
    if (d.length < c.len[0] || d.length > c.len[1]) {
      return { ok: false, error: c.ddi === '55' ? 'Informe DDD + número de celular (11 dígitos).' : `Número com ${c.len[0]} dígitos, sem o +${c.ddi}.` };
    }
    if (c.mobile && !c.mobile.test(d)) return { ok: false, error: 'Esse número não parece ser de celular.' };
    if (/^(\d)\1+$/.test(d)) return { ok: false, error: 'Número inválido.' };
    return { ok: true, e164: c.ddi + d };
  }

  const api = { COUNTRIES, format, validate, digits };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FPhone = api;
})(typeof self !== 'undefined' ? self : this);
