# Funnel — landing com quiz de qualificação

Landing estática + funções serverless (Vercel). O visitante responde perguntas de múltipla escolha;
só quem se qualifica deixa nome, Instagram e WhatsApp e cai numa tela de "perfil aprovado" com o
WhatsApp aberto e mensagem pronta (com o código do lead). Quem não se qualifica vai para
`/downsell` (oferta mais barata) ou `/material` (conteúdo gratuito).

## Rodar local

```bash
pnpm install
ADMIN_PASSWORD=troque-isto pnpm --filter funnel dev   # gera dist/ e sobe em http://localhost:3100
pnpm --filter funnel test
```

Sem `DATABASE_URL`, leads e visitas vão para `apps/funnel/.data/*.json`.

## Painel (`/admin`)

Entra com a senha de `ADMIN_PASSWORD` (sessão de 7 dias em cookie HttpOnly assinado; trocar a senha derruba as sessões).

- **Visão geral** (por período): visitas, respostas, qualificados, cliques no WhatsApp, fechados; gráfico por dia;
  funil; etapas de atendimento; origem (`utm_source`); teste A/B claro × escuro; distribuição de cada resposta.
- **Leads**: busca por nome, @, WhatsApp ou código; filtros de status e etapa; paginação; exportar CSV (abre no Excel).
- **Detalhe do lead**: respostas, origem, botões para WhatsApp e Instagram, etapa
  (novo → contatado → negociando → fechado / perdido) e anotações.

Os números da visão geral consideram até 5.000 leads por período.

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
2. Variáveis: `DATABASE_URL` (Postgres: Neon, Supabase, Vercel Postgres), `ADMIN_PASSWORD`
   (senha forte) e, opcionais, `SESSION_SECRET` e `ADMIN_KEY`.
3. Crie as tabelas: `psql "$DATABASE_URL" -f apps/funnel/db/schema.sql` (rode de novo ao atualizar: só cria o que falta).

`vercel.json` já define build (`node build.mjs`), saída (`dist`) e URLs limpas.

## Estrutura

```
funnel.config.json   textos, perguntas, regras
build.mjs            src/ + config → dist/
src/                 templates HTML + assets (styles.css, js/app.js)
shared/              qualify.js e phone.js (rodam no navegador e no servidor)
api/                 funções serverless
lib/                 regras do lead, store (Postgres ou JSON), utilidades HTTP
db/schema.sql        tabela leads
dev-server.js        servidor local que imita a Vercel
```
