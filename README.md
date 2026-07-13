# Monorepo

This repo hosts two independent products:

- **Meet Scheduler** (`apps/api`, `apps/web`, `packages/sdk`) — documented below.
- **Pipeline Signal** (`apps/gojiberry-api`, `apps/gojiberry-web`, `packages/gojiberry-sdk`) — an AI go-to-market/sales-intelligence app inspired by Gojiberry AI. See [`apps/gojiberry-api/README.md`](apps/gojiberry-api/README.md) for setup.

They run on separate ports and separate Postgres/Redis instances (see `docker-compose.yml`) so both can be developed at the same time.

---

# Meet Scheduler

Sistema de agendamento de reuniões multi-plataforma. Encontra horários livres comuns entre participantes de diferentes organizações que usam Google Calendar ou Microsoft Outlook — sem expor detalhes dos eventos de ninguém.

## Funcionalidades

- **Convite anônimo**: participantes recebem um link por email e conectam seu calendário (somente livre/ocupado é consultado)
- **Multi-plataforma**: Google Calendar ↔ Microsoft Outlook ↔ qualquer combinação
- **API REST + Swagger**: consumível por outros sistemas com API key
- **Webhooks**: notificações em tempo real para sistemas externos
- **SDK TypeScript**: pacote `@meet-scheduler/sdk` para integração fácil

## Estrutura

```
apps/
  api/    ← NestJS + Prisma + PostgreSQL + Redis
  web/    ← Next.js 14 (frontend)
packages/
  sdk/    ← TypeScript SDK (@meet-scheduler/sdk)
```

## Setup Rápido

### 1. Pré-requisitos

- Node.js >= 20
- pnpm >= 9
- Docker (para PostgreSQL + Redis)
- Credenciais OAuth no [Google Cloud Console](https://console.cloud.google.com) e [Azure App Registrations](https://portal.azure.com)

### 2. Configurar variáveis de ambiente

```bash
cp .env.example apps/api/.env
# Preencher: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
#            MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET,
#            JWT_SECRET, ENCRYPTION_KEY (32 bytes hex), RESEND_API_KEY
```

### 3. Iniciar serviços

```bash
docker compose up -d          # PostgreSQL + Redis
pnpm install
pnpm db:migrate               # Criar tabelas
pnpm dev                      # API :3001 + Web :3000
```

### 4. Acessar

| Serviço  | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API      | http://localhost:3001/api/v1 |
| Swagger  | http://localhost:3001/api/docs |

## Fluxo Completo

1. Organizador cria conta e conecta seu Google/Microsoft Calendar em `/app/dashboard`
2. Cria uma reunião em `/app/meetings/new` com período e janela de horário
3. Adiciona participantes por email — cada um recebe um convite
4. Participante clica no link → escolhe Google ou Microsoft → autoriza acesso anônimo (apenas livre/ocupado)
5. Organizador vê `GET /meetings/:id/slots` → lista de horários disponíveis para todos
6. Confirma um slot → todos recebem email de confirmação

## SDK

```typescript
import { MeetSchedulerClient } from '@meet-scheduler/sdk';

const client = new MeetSchedulerClient({
  apiKey: 'sk_...',
  baseUrl: 'https://seu-servidor.com/api/v1',
});

const meeting = await client.meetings.create({
  title: 'Sprint Planning',
  durationMin: 60,
  dateRangeStart: '2026-06-01',
  dateRangeEnd: '2026-06-07',
  timeWindowStart: '09:00',
  timeWindowEnd: '18:00',
  timezone: 'America/Sao_Paulo',
});

await client.meetings.addParticipant(meeting.id, 'alice@corp.com');

const slots = await client.meetings.getSlots(meeting.id);
await client.meetings.confirm(meeting.id, slots[0].start);
```

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL |
| `JWT_SECRET` | Segredo para tokens JWT |
| `ENCRYPTION_KEY` | 32 bytes hex para criptografar tokens OAuth no banco |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Google |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Google |
| `MICROSOFT_CLIENT_ID` | OAuth 2.0 Microsoft (Azure App Registration) |
| `MICROSOFT_CLIENT_SECRET` | OAuth 2.0 Microsoft |
| `MICROSOFT_TENANT_ID` | Tenant ID (use `common` para multi-tenant) |
| `RESEND_API_KEY` | API key do Resend para envio de emails |
| `EMAIL_FROM` | Endereço de envio dos emails |
| `WEB_URL` | URL do frontend (para redirects OAuth) |

## Webhooks

Eventos disponíveis:
- `meeting.slot_confirmed` — horário confirmado
- `participant.connected` — participante conectou calendário
- `participant.declined` — participante recusou

Cada webhook é entregue com header `X-MeetScheduler-Signature: sha256=<hmac>` para verificação.

## Desenvolvimento

```bash
pnpm test           # Testes unitários
pnpm lint           # ESLint
pnpm db:studio      # Prisma Studio (GUI do banco)
```
