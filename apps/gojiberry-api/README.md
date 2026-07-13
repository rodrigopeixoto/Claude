# Pipeline Signal

An AI go-to-market agent for B2B sales teams, inspired by [Gojiberry AI](https://gojiberry.ai/): describe your ideal customer in a prompt, get an AI-generated lead list, track buying-intent signals, and send AI-personalized outreach — with automated multi-step sequences.

Named "Pipeline Signal" rather than "Gojiberry" — this is a functional clone of the *product concept*, not a rebrand of their trademark.

## Funcionalidades

- **Lista de leads via prompt**: descreva seu ICP em uma frase; a IA extrai critérios estruturados e gera um primeiro lote de leads.
- **Enriquecimento de contatos**: dados de empresa/contato via provider plugável (`EnrichmentProvider`), com um mock funcional por padrão.
- **Sinais de intenção de compra**: mudança de emprego, rodada de investimento, engajamento social, etc., via provider plugável (`SignalProvider`).
- **Outreach com IA**: mensagens personalizadas geradas a partir do cargo, empresa e sinais mais recentes do lead.
- **Sequências (campanhas)**: múltiplas etapas com atraso configurável, processadas por um cron job.
- **API REST + Swagger, API keys, webhooks**: mesmo padrão de integração do Meet Scheduler.

## ⚠️ Sobre os sinais do LinkedIn

Este projeto **não faz scraping do LinkedIn** — automatizar login/raspagem de perfis viola os Termos de Uso da plataforma. Em vez disso, o módulo de sinais é uma interface plugável:

```
apps/gojiberry-api/src/signals/providers/signal-provider.interface.ts
apps/gojiberry-api/src/signals/providers/mock-signal.provider.ts   ← ativo por padrão
```

O `MockSignalProvider` gera sinais realistas (mas fictícios) para que o produto funcione de ponta a ponta localmente. Para usar dados reais, implemente `SignalProvider` contra uma fonte de dados licenciada e compatível (ex: um provedor de intent-data B2B com API oficial) e troque o binding em `signals.module.ts` — nenhum outro código precisa mudar. O mesmo padrão vale para enriquecimento (`leads/providers/`).

## Estrutura

```
apps/
  gojiberry-api/  ← NestJS + Prisma + PostgreSQL + Redis
  gojiberry-web/  ← Next.js 14 (frontend)
packages/
  gojiberry-sdk/  ← TypeScript SDK (@gojiberry-clone/sdk)
```

## Setup Rápido

### 1. Pré-requisitos

- Node.js >= 20, pnpm >= 9, Docker

### 2. Variáveis de ambiente

```bash
cp apps/gojiberry-api/.env.example apps/gojiberry-api/.env
cp apps/gojiberry-web/.env.example apps/gojiberry-web/.env
```

`ANTHROPIC_API_KEY` e `RESEND_API_KEY` são opcionais — sem elas, geração de ICP/leads/mensagens usa fallback determinístico e envio de email roda em modo dry-run (loga no console).

### 3. Iniciar serviços

```bash
docker compose up -d gojiberry-postgres gojiberry-redis
pnpm install
pnpm gojiberry:db:migrate
pnpm --filter gojiberry-api dev     # API :3011
pnpm --filter gojiberry-web dev     # Web :3010
```

### 4. Acessar

| Serviço  | URL |
|----------|-----|
| Frontend | http://localhost:3010 |
| API      | http://localhost:3011/api/v1 |
| Swagger  | http://localhost:3011/api/docs |

## Fluxo Completo

1. Criar conta em `/register`
2. Em `/app/icp/new`, descrever o ICP em uma frase → IA gera critérios + primeira lista de leads
3. Em `/app/leads/:id`, buscar sinais e gerar/editar/enviar uma mensagem de outreach com IA
4. Em `/app/campaigns`, criar uma sequência de etapas e inscrever leads — o cron processa os envios automaticamente conforme o atraso configurado

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL |
| `JWT_SECRET` | Segredo para tokens JWT |
| `ANTHROPIC_API_KEY` | Opcional — habilita geração real via Claude; sem ela, usa mocks determinísticos |
| `RESEND_API_KEY` | Opcional — habilita envio real de email; sem ela, roda em dry-run |
| `EMAIL_FROM` | Endereço de envio dos emails |
| `WEB_URL` | URL do frontend (CORS) |

## Webhooks

Eventos disponíveis: `lead.created`, `lead.signal_detected`, `message.generated`, `message.sent`. Entregues com header `X-Gojiberry-Signature: sha256=<hmac>`.

## Desenvolvimento

```bash
pnpm --filter gojiberry-api test
pnpm --filter gojiberry-api lint
pnpm gojiberry:db:studio
```
