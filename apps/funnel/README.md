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
src/                 templates HTML + assets (styles.css, js/app.js)
shared/              qualify.js e phone.js (rodam no navegador e no servidor)
api/                 funções serverless
lib/                 regras do lead, store (Postgres ou memória com dados fake), auth, métricas
db/schema.sql        tabela leads
dev-server.js        servidor local que imita a Vercel
```
