import type { SourceType } from "@prisma/client";

export interface SourceTemplate {
  label: string;
  intervalMinutes: number;
  config: Record<string, unknown>;
  help: string;
  requires?: string;
}

export const SOURCE_TEMPLATES: Record<SourceType, SourceTemplate> = {
  GOOGLE_NEWS: {
    label: "Google News",
    intervalMinutes: 60,
    config: { query: "" },
    help: "Busca no Google News (últimos 7 dias). query vazia = palavras-chave do cliente. Aceita operadores: \"Nubank\" -vaga.",
  },
  GDELT: {
    label: "GDELT (notícias globais)",
    intervalMinutes: 180,
    config: { query: "", sourcelang: "por", timespan: "3d" },
    help: "Índice global de notícias. sourcelang: por, eng ou any. Termos com menos de 3 letras são rejeitados pelo GDELT.",
  },
  RSS: {
    label: "Feed RSS/Atom",
    intervalMinutes: 120,
    config: { url: "https://", matchAll: false },
    help: "Qualquer feed (portal, blog, sala de imprensa). matchAll=false mantém só itens que citam as palavras-chave.",
  },
  APP_STORE: {
    label: "App Store (reviews)",
    intervalMinutes: 360,
    config: { appId: "", country: "br", pages: 2 },
    help: "appId = número na URL da App Store (apps.apple.com/br/app/nome/id814456780 → 814456780).",
  },
  PLAY_STORE: {
    label: "Google Play (reviews)",
    intervalMinutes: 360,
    config: { appId: "", lang: "pt", country: "br", num: 150 },
    help: "appId = parâmetro id da URL do Google Play (ex.: com.nu.production).",
  },
  YOUTUBE: {
    label: "YouTube",
    intervalMinutes: 720,
    config: { query: "", channelId: "" },
    help: "Vídeos recentes citando o cliente (query) e/ou de um canal (channelId). Cada busca gasta 100 da cota diária de 10 000.",
    requires: "YOUTUBE_API_KEY",
  },
  RECLAME_AQUI: {
    label: "Reclame Aqui",
    intervalMinutes: 720,
    config: { actorId: "", input: { companyUrl: "https://www.reclameaqui.com.br/empresa/SLUG/", maxItems: 50 }, maxItems: 50 },
    help: "Sem API pública: usa um actor do Apify Store (busque \"reclame aqui\"). Copie o ID do actor e o formato de input da página dele.",
    requires: "APIFY_TOKEN",
  },
  LINKEDIN: {
    label: "LinkedIn",
    intervalMinutes: 1440,
    config: { actorId: "", input: { searchQueries: ["{{firstKeyword}}"], maxPosts: 50 }, maxItems: 50 },
    help: "Posts que citam a empresa ou da página dela, via actor do Apify (busque \"linkedin posts\"). Nunca use sua conta pessoal.",
    requires: "APIFY_TOKEN",
  },
  INSTAGRAM: {
    label: "Instagram",
    intervalMinutes: 720,
    config: { actorId: "", input: { directUrls: ["https://www.instagram.com/PERFIL/"], resultsLimit: 30 }, maxItems: 50 },
    help: "Posts de perfil ou hashtag via actor do Apify (busque \"instagram scraper\").",
    requires: "APIFY_TOKEN",
  },
  FACEBOOK: {
    label: "Facebook",
    intervalMinutes: 720,
    config: { actorId: "", input: { startUrls: [{ url: "https://www.facebook.com/PAGINA" }], resultsLimit: 30 }, maxItems: 50 },
    help: "Posts de página via actor do Apify (busque \"facebook posts scraper\").",
    requires: "APIFY_TOKEN",
  },
};

export const CHANNEL_LABELS: Record<string, string> = {
  NEWS: "Notícias",
  APP_STORE: "App Store",
  PLAY_STORE: "Google Play",
  RECLAME_AQUI: "Reclame Aqui",
  YOUTUBE: "YouTube",
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
};

export const TOPIC_LABELS: Record<string, string> = {
  atendimento: "Atendimento",
  preco_cobranca: "Preço/cobrança",
  produto: "Produto",
  bug_tecnico: "Bug/instabilidade",
  entrega_prazo: "Entrega/prazo",
  fraude_seguranca: "Fraude/segurança",
  institucional: "Institucional",
  resultados_financeiros: "Resultados/mercado",
  pessoas_cultura: "Pessoas/cultura",
  marketing_campanha: "Marketing/campanha",
  elogio: "Elogio",
  outro: "Outro",
};
