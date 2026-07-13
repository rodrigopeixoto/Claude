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

O actor padrão (`harvestapi/linkedin-profile-scraper`) tem dois modos de cobrança (campo `profileScraperMode`, não exposto por `POST /linkedin/profiles`): "Profile details no email" (~$4/1k) e "Profile details + email search" (~$10/1k). Sem esse campo ele usa o modo padrão sem busca de e-mail. Para escolher o modo de e-mail, use `POST /linkedin/run` passando `profileScraperMode` no `input`.

```bash
pnpm --filter linkedin-scraper dev
```

Swagger UI disponível em `http://localhost:3002/api/docs`.

## Endpoints

Todos exigem o header `x-api-key: <SCRAPER_API_KEY>`.

### `POST /api/v1/linkedin/profiles`

Inicia um run do actor configurado (`APIFY_LINKEDIN_ACTOR_ID`) para uma lista de URLs de perfil.

```json
{ "urls": ["https://www.linkedin.com/in/exemplo/"] }
```

Retorna `{ runId, actorId, datasetId, status }`. O run roda de forma assíncrona no Apify — use o endpoint abaixo para consultar o resultado.

### `POST /api/v1/linkedin/run`

Dispara qualquer actor do Apify passando o input cru, para casos em que o actor padrão não serve ou o schema é diferente.

```json
{ "actorId": "usuario/nome-do-actor", "input": { "profileUrls": ["https://www.linkedin.com/in/exemplo/"] } }
```

### `GET /api/v1/linkedin/runs/:runId`

Consulta o status do run. Quando `status` for `SUCCEEDED`, a resposta inclui `items` com os dados raspados do dataset.

## Nota

O scraping de dados do LinkedIn está sujeito aos termos de uso do LinkedIn e do actor escolhido no Apify. Use apenas com autorização adequada e para dados que você tem permissão de coletar.
