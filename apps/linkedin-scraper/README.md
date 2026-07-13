# LinkedIn Scraper

Serviço NestJS que dispara scraping de perfis do LinkedIn através do [Apify](https://apify.com/), usando o `apify-client` oficial para iniciar runs de um actor e consultar os resultados.

## Setup

```bash
cp apps/linkedin-scraper/.env.example apps/linkedin-scraper/.env
```

Preencher no `.env`:

- `SCRAPER_API_KEY`: chave que os clientes devem enviar no header `x-api-key` para chamar esta API.
- `APIFY_API_TOKEN`: token da sua conta Apify (Apify Console → Settings → Integrations).
- `APIFY_LINKEDIN_ACTOR_ID`: ID do actor do Apify Store que faz o scraping de perfis do LinkedIn. Configurado por padrão para `harvestapi/linkedin-profile-scraper`; troque na [Apify Store](https://apify.com/store) se quiser outro.
- `APIFY_PROFILE_URL_FIELD`: nome do campo de input que esse actor espera para receber a lista de URLs (varia por actor; para o `harvestapi/linkedin-profile-scraper` é `urls`).
- `APIFY_SEARCH_ACTOR_ID`: actor usado por `POST /linkedin/search` (busca com filtros, sem login/cookies). Padrão: `harvestapi/linkedin-profile-search`.
- `APIFY_POSTS_ACTOR_ID`: actor usado para buscar os posts recentes de um lead. Padrão: `harvestapi/linkedin-profile-posts`.
- `DATABASE_URL`: banco SQLite do CRM (leads/outreach) — arquivo local, criado automaticamente, nenhuma instalação extra necessária.
- `TIMEZONE`, `BUSINESS_HOURS_START`, `BUSINESS_HOURS_END`, `BUSINESS_DAYS`: janela de horário comercial em que é permitido marcar um item como enviado.
- `DAILY_CONNECTION_LIMIT`, `DAILY_MESSAGE_LIMIT`, `DAILY_ACTION_LIMIT`, `CONNECTION_WITHDRAW_DAYS`: limites diários e prazo de retirada de convites, aplicados pela API (não são só sugestão da UI).

O actor padrão de perfis (`harvestapi/linkedin-profile-scraper`) tem dois modos de cobrança (campo `profileScraperMode`, não exposto por `POST /linkedin/profiles`): "Profile details no email" (~$4/1k) e "Profile details + email search" (~$10/1k). Sem esse campo ele usa o modo padrão sem busca de e-mail. Para escolher o modo de e-mail, use `POST /linkedin/run` passando `profileScraperMode` no `input`.

```bash
pnpm --filter linkedin-scraper dev
```

- **Interface de teste**: `http://localhost:3002/` — página HTML simples com abas "Por URL" e "Busca avançada" pra disparar scrapes e ver o resultado sem precisar de curl/Postman.
- **CRM de outreach**: `http://localhost:3002/admin.html` — leads, rascunhos, fila de envio e retirada de convites (veja a seção abaixo).
- **Swagger UI**: `http://localhost:3002/api/docs`.

## CRM de outreach (`/admin.html`)

Esta parte **não envia nada automaticamente no LinkedIn** — é uma ferramenta de apoio para outreach manual. Você (ou sua equipe) continua fazendo o convite/mensagem de verdade pelo próprio LinkedIn; o sistema só organiza quem contatar, guarda o rascunho da mensagem e controla o ritmo.

1. **Leads**: salve leads a partir da busca (botão "Salvar como lead" em `/`) ou via `POST /leads`. Cada lead pode ter posts recentes buscados (`Buscar posts recentes`, via Apify) para dar contexto à mensagem.
2. **Gerar rascunho**: escreva um template com placeholders `{{firstName}}`, `{{fullName}}`, `{{company}}`, `{{headline}}`, `{{post}}` (texto do post mais recente) e gere um rascunho por lead. **Revise e edite** antes de enfileirar — nada é enviado automaticamente.
3. **Fila de envio**: itens enfileirados aparecem aqui. Você faz o envio manualmente no LinkedIn e só então clica em "marcar como enviado" — a API valida:
   - se está dentro do horário comercial configurado (`TIMEZONE`, `BUSINESS_HOURS_START/END`, `BUSINESS_DAYS`);
   - se os limites diários (`DAILY_CONNECTION_LIMIT`, `DAILY_MESSAGE_LIMIT`, `DAILY_ACTION_LIMIT`) ainda não foram atingidos.

   Fora desses critérios, a marcação é **rejeitada** (HTTP 403) — os limites não são apenas visuais, são reforçados no backend.
4. **Enviados**: acompanhe status (aceito/respondido) dos itens já enviados.
5. **Retirar convites**: convites de conexão enviados há mais de `CONNECTION_WITHDRAW_DAYS` dias (padrão 10) aparecem aqui para você retirar manualmente no LinkedIn e marcar como retirado.

Endpoints principais: `POST/GET /leads`, `POST /leads/:id/posts/scrape` + `/posts/import`, `POST /outreach/drafts`, `POST /outreach/drafts/generate`, `POST /outreach/:id/queue`, `GET /outreach/queue`, `GET /outreach/stats`, `POST /outreach/:id/mark-sent`, `POST /outreach/:id/status`, `GET /outreach/due-for-withdrawal`. Detalhes de cada um no Swagger.

## Endpoints

Todos exigem o header `x-api-key: <SCRAPER_API_KEY>`.

### `POST /api/v1/linkedin/profiles`

Inicia um run do actor configurado (`APIFY_LINKEDIN_ACTOR_ID`) para uma lista de URLs de perfil.

```json
{ "urls": ["https://www.linkedin.com/in/exemplo/"] }
```

Retorna `{ runId, actorId, datasetId, status }`. O run roda de forma assíncrona no Apify — use o endpoint abaixo para consultar o resultado.

### `POST /api/v1/linkedin/search`

Inicia uma busca filtrada de perfis (actor `APIFY_SEARCH_ACTOR_ID`), sem precisar de URLs específicas nem de login no LinkedIn.

```json
{
  "searchQuery": "Product Designer",
  "locations": ["São Paulo, Brazil"],
  "currentCompanies": ["https://www.linkedin.com/company/google/"],
  "currentJobTitles": ["Product Designer"],
  "seniorityLevelIds": ["120"],
  "profileLanguages": ["Portuguese"],
  "maxItems": 20
}
```

Filtros suportados: `searchQuery`, `locations`, `currentCompanies`, `pastCompanies`, `schools`, `currentJobTitles`, `pastJobTitles`, `firstNames`, `lastNames`, `industryIds` (códigos numéricos), `seniorityLevelIds`, `profileLanguages`, `companyHeadcount`, `maxItems`, `profileScraperMode`. Veja os enums completos no Swagger.

**Não suportado** (exigem sessão autenticada do LinkedIn, fora de escopo aqui): grau de conexão (1º/2º/3º), "contratando já", conexões-de/seguidores-de um perfil específico, interesse em voluntariado, categorias de serviço (esse último existe em outro actor: `harvestapi/linkedin-profile-search-by-services`, acessível via `POST /linkedin/run`).

### `POST /api/v1/linkedin/run`

Dispara qualquer actor do Apify passando o input cru, para casos em que o actor padrão não serve ou o schema é diferente.

```json
{ "actorId": "usuario/nome-do-actor", "input": { "profileUrls": ["https://www.linkedin.com/in/exemplo/"] } }
```

### `GET /api/v1/linkedin/runs/:runId`

Consulta o status do run. Quando `status` for `SUCCEEDED`, a resposta inclui `items` com os dados raspados do dataset.

## Nota

O scraping de dados do LinkedIn está sujeito aos termos de uso do LinkedIn e do actor escolhido no Apify. Use apenas com autorização adequada e para dados que você tem permissão de coletar.
