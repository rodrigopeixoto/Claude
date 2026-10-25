// Configuração do funil: funnel.config.json com sobrescritas por variável de ambiente
// (assim o mesmo repositório serve vários clientes sem editar o JSON).

const base = require('../funnel.config.json');

function loadConfig(env = process.env) {
  const cfg = structuredClone(base);
  if (env.FUNNEL_WHATSAPP) cfg.contact.whatsapp = env.FUNNEL_WHATSAPP;
  if (env.FUNNEL_BRAND) cfg.brand.name = env.FUNNEL_BRAND;
  return cfg;
}

// O que o navegador pode ver: nada de regra interna além do que já está na página
function publicConfig(cfg) {
  return {
    brand: cfg.brand.name,
    whatsapp: String(cfg.contact.whatsapp || '').replace(/\D/g, ''),
    whatsappMessage: cfg.contact.whatsappMessage,
  };
}

module.exports = { loadConfig, publicConfig };
