# Funnel — landing com quiz de qualificação

Landing estática + funções serverless (Vercel). O visitante responde perguntas de múltipla escolha;
só quem se qualifica deixa nome, Instagram e WhatsApp e cai numa tela de "perfil aprovado" com o
WhatsApp aberto e mensagem pronta (com o código do lead). Quem não se qualifica vai para
`/downsell` (oferta mais barata) ou `/material` (conteúdo gratuito).

## Rodar local

```bash
cd apps/funnel
npm run dev        # gera dist/ e sobe em http://localhost:3100 (painel: /admin, senha "demo")
npm test
```

Em modo demonstração não precisa instalar nada além do Node 20+. `ADMIN_PASSWORD=outra npm run dev`
troca a senha; `PORT=4000` troca a porta. A senha padrão "demo" vale só no servidor local.

## Modo demonstração (sem banco)

Sem `DATABASE_URL` o sistema roda com **dados fake em memória** (`lib/demo.js`): ~260 leads e visitas
dos últimos 60 dias, com nomes, WhatsApp, origens, etapas e anotações de exemplo. Os dados são os mesmos
para o mesmo dia (semente fixa). Leads que entram pelo quiz e alterações feitas no painel ficam só na
memória: somem quando o servidor reinicia (na Vercel, a cada instância nova). O painel mostra uma faixa
avisando. Para dados reais, defina `DATABASE_URL`.

## Painel (`/admin`)

Entra com a senha de `ADMIN_PASSWORD` (sessão de 7 dias em cookie HttpOnly assinado; trocar a senha derruba as sessões).

- **Visão geral** (por período): visitas, respostas, qualificados, cliques no WhatsApp, fechados; gráfico por dia;
  funil; etapas de atendimento; origem (`utm_source`); teste A/B claro × escuro; distribuição de cada resposta.
- **Leads**: busca por nome, @, WhatsApp ou código; filtros de status e etapa; paginação; exportar CSV (abre no Excel).
- **Detalhe do lead**: respostas, origem, botões para WhatsApp e Instagram, etapa
  (novo → contatado → negociando → fechado / perdido) e anotações.

Os números da visão geral consideram até 5.000 leads por período.

## Páginas de links dos clientes (o produto)

Cada cliente é um arquivo `pages/<slug>.json`. O build gera a página em `/<slug>`
(ex.: `pages/dra-ana-lima.json` → http://localhost:3100/dra-ana-lima). Exemplos prontos:
`dra-ana-lima` (nutricionista, claro), `rodrigo-alves-advocacia` (advogado, escuro com serifa),
`studio-marina-costa` (arquiteta, vitrine de projetos). Eles também aparecem ao vivo nos celulares
do topo da landing (`hero.showcase` no config).

**Novo cliente:** copie um exemplo, troque `slug` e o conteúdo, rode `npm run dev`.
O build avisa o que estiver errado (slug inválido ou repetido, bloco inexistente, link inválido, cor fora do formato).

Campos do topo:

| Campo | Exemplo |
|---|---|
| `slug` | `dra-ana-lima` (minúsculas, números e hífen) |
| `name`, `role`, `location`, `bio` | textos do cabeçalho |
| `verified` | `true` mostra o selo |
| `badges` | `["CRN-3 12345", "+2.000 pacientes"]` |
| `avatar`, `cover.image` | URL ou `/img/arquivo.jpg` (sem foto: iniciais e gradiente na cor da marca) |
| `theme` | `{ "style": "claro" ou "escuro", "accent": "#2f9e6b", "font": "sans", "serif" ou "rounded" }` |
| `whatsapp` | número com DDI, usado pelos botões |
| `cta` | botão fixo de WhatsApp: `{ "label": "Agendar consulta", "message": "Olá!..." }` |
| `social` | `instagram`, `youtube`, `tiktok`, `linkedin`, `email` |

Blocos (`blocks`, na ordem em que aparecem):

| `type` | Para quê | Campos |
|---|---|---|
| `highlight` | oferta principal | `tag`, `title`, `text`, `image`, `button: { label, url ou whatsappMessage }` |
| `links` | lista de botões | `title`, `items: [{ icon, label, sub, url ou whatsappMessage }]` |
| `grid` | vitrine de produtos/projetos | `title`, `items: [{ title, price, image, icon, url }]` |
| `video` | vídeo do YouTube (carrega ao tocar) | `title`, `youtube` (id de 11 caracteres) |
| `testimonials` | depoimentos em carrossel | `title`, `items: [{ text, author }]` |
| `location` | endereço com link para o mapa | `title`, `address`, `hours`, `mapsUrl` |
| `faq` | perguntas e respostas | `title`, `items: [{ q, a }]` |
| `stats` | números/credenciais | `items: [{ value, label }]` |

Ícones: `whatsapp instagram youtube tiktok linkedin email phone calendar link map play star cart book doc gift check arrow clock chat`.
Imagens locais vão em `src/assets/img/` e são usadas como `/img/arquivo.jpg`.

## Personalizar

Tudo em `funnel.config.json` (rode `pnpm --filter funnel build` depois de editar):

| Chave | O que muda |
|---|---|
| `brand` | nome, autor, prefixo do código do lead (`SM-XXXXXX`), tema padrão, teste A/B claro × escuro |
| `contact` | número do WhatsApp e modelo da mensagem (`{brand}`, `{nameSentence}`, `{code}`) |
| `hero`, `sections`, `seo` | textos da landing |
| `quiz.questions` | perguntas e opções. `outcome: "downsell"` ou `"material"` numa opção tira o lead da qualificação (material vence downsell). `otherField` abre campo de texto. `titleBy` troca o título conforme uma resposta anterior |
| `pages` | textos e links de `/downsell` e `/material` |

Variáveis de ambiente opcionais: `FUNNEL_WHATSAPP`, `FUNNEL_BRAND` sobrescrevem o JSON.

## API

| Rota | Uso |
|---|---|
| `GET /api/config` | marca, WhatsApp e modelo da mensagem para o navegador |
| `POST /api/leads` | respostas do quiz → `{ status }` (+ `leadId`, `token`, `code` se qualificado). 422 com `fields`, 429 limite por IP |
| `POST /api/whatsapp` | `{ leadId, token }`: marca o clique no WhatsApp |
| `POST /api/visit` | `{ tema }`: conta visita para o teste A/B |
| `GET/POST/DELETE /api/session` | estado do login / entrar `{ password }` / sair |
| `GET /api/leads` 🔒 | lista com `from`, `to` (YYYY-MM-DD), `status`, `stage`, `q`, `limit`, `offset` |
| `GET/PATCH /api/lead?id=` 🔒 | detalhe / atualiza `{ stage, notes }` |
| `GET /api/stats` 🔒 | números da visão geral (`from`, `to`; padrão 30 dias) |
| `GET /api/export` 🔒 | CSV com os mesmos filtros da lista |

🔒 = sessão do painel ou `Authorization: Bearer $ADMIN_KEY` (para integrações).

Proteções: honeypot, tempo mínimo de preenchimento (3s), limite de 8 envios por IP a cada 10 min,
validação de WhatsApp por país, e a regra de qualificação (`shared/qualify.js`) é reavaliada no servidor.

## Deploy na Vercel

1. Novo projeto apontando para este repositório, **Root Directory** = `apps/funnel`.
2. Variável `ADMIN_PASSWORD` (senha forte). Só isso já sobe em modo demonstração.
3. Quando quiser dados reais: crie um Postgres (Neon, Supabase, Vercel Postgres), defina `DATABASE_URL`
   e rode `psql "$DATABASE_URL" -f apps/funnel/db/schema.sql` (pode rodar de novo ao atualizar: só cria o que falta).

Opcionais: `SESSION_SECRET`, `ADMIN_KEY`.

`vercel.json` já define build (`node build.mjs`), saída (`dist`) e URLs limpas.

## Estrutura

```
funnel.config.json   textos, perguntas, regras
build.mjs            src/ + config → dist/
src/                 templates HTML + assets (styles.css, admin.css, linkpage.css, js/)
pages/               uma página de links por cliente (JSON)
linkpage.mjs         gera a página de links a partir do JSON
shared/              qualify.js e phone.js (rodam no navegador e no servidor)
api/                 funções serverless
lib/                 regras do lead, store (Postgres ou memória com dados fake), auth, métricas
db/schema.sql        tabela leads
dev-server.js        servidor local que imita a Vercel
```
