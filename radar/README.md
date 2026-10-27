# Radar de Clientes

Monitoramento de reputação por cliente: coleta menções em notícias, lojas de apps, Reclame Aqui, YouTube, LinkedIn, Instagram e Facebook, classifica cada uma (sentimento, tema, severidade, se é reclamação) e consolida tudo em um score de saúde de 0 a 100 por cliente, com alertas.

## Arquitetura

```
Next.js (dashboard + gestão de fontes)  ─┐
                                          ├─ PostgreSQL
Worker (npm run worker)                  ─┘
  a cada tick: fontes vencidas → coletores → dedupe → classificação → score diário → alertas
```

| Peça | Onde |
|---|---|
| Coletores | `src/lib/collectors/` — um arquivo por tipo de fonte |
| Coleta + dedupe | `src/lib/pipeline/runSource.ts` |
| Classificação | `src/lib/analysis/` — Claude (`llm.ts`) com fallback heurístico em português (`heuristic.ts`) |
| Score de saúde | `src/lib/health/score.ts` (função pura) e `compute.ts` (snapshot diário) |
| Alertas | `src/lib/alerts.ts` — menção crítica, pico de negativas, queda de score; webhook opcional (Slack) |
| Worker | `src/worker/` |
| Dashboard | `src/app/` |

## Fontes

| Tipo | Como coleta | Precisa |
|---|---|---|
| Google News | RSS de busca, últimos 7 dias | nada |
| GDELT | API DOC 2.0 (notícias globais) | nada; limite de ~1 req/5 s por IP |
| RSS/Atom | qualquer feed; filtra pelas palavras-chave | nada |
| App Store | RSS público de reviews da Apple | ID numérico do app |
| Google Play | `google-play-scraper` | package do app (`com.empresa.app`) |
| YouTube | YouTube Data API v3 (busca + estatísticas) | `YOUTUBE_API_KEY` |
| Reclame Aqui, LinkedIn, Instagram, Facebook | qualquer actor do [Apify Store](https://apify.com/store) | `APIFY_TOKEN` + `actorId` |

Para Apify: escolha o actor na Store, copie o ID (`autor~nome`) e o formato de input da página do actor para o campo `input` da fonte. Strings do input aceitam `{{keywords}}`, `{{keywordsList}}`, `{{firstKeyword}}`, `{{since}}` e `{{sinceDate}}`. Os campos de saída são mapeados automaticamente (texto, url, autor, data, likes…); se o actor usar nomes diferentes, defina `fieldMap`, por exemplo `{"content": "complaint.body", "date": "created"}`.

Não use sua conta pessoal do LinkedIn/Instagram para raspagem: viola os termos das plataformas e leva a bloqueio.

## Score de saúde

Janela de 7 dias. Componentes (0–100) e pesos; os que não têm dados suficientes saem e os pesos são redistribuídos:

- Sentimento médio ponderado por engajamento — 35%
- Nota média nas lojas (30 dias) — 20%
- Risco: menções de severidade 2 e 3, com penalidade proporcional ao volume — 20%
- Proporção de reclamações — 15%
- Pico de negativas em relação à média das 4 semanas anteriores — 10%

Faixas: ≥ 75 saudável, 60–74 atenção, 45–59 risco, < 45 crítico.

Menções podem ser marcadas como irrelevantes no dashboard (homônimos, spam); elas saem do cálculo na hora.

## Rodar no Mac com um clique

1. Baixe e descompacte a pasta `radar`.
2. Dê duplo clique em **`Radar.command`**. Na primeira vez o macOS pode bloquear por ser um arquivo baixado: clique com o botão direito → **Abrir** → **Abrir**.
3. Na primeira execução ele baixa o Node.js (se você não tiver), instala as dependências, cria o banco local e prepara o painel (3–5 min). Nas próximas, abre em segundos.
4. O navegador abre em http://localhost:3000. Deixe a janela do Terminal aberta enquanto usa; feche-a (ou Ctrl+C) para parar.

Chaves (Anthropic, YouTube, Apify) vão no arquivo `.env`, criado na primeira execução. Para editar: abra o Terminal na pasta e rode `open -e .env`, ou pressione Cmd+Shift+. no Finder para ver arquivos ocultos. Depois de editar, feche e abra o Radar de novo.

Os dados ficam em `radar/data/`. Não precisa de Docker nem de Postgres instalado: o banco é embutido.

Se o duplo clique não funcionar, abra o Terminal e rode: `bash ~/Downloads/radar/Radar.command` (ajuste o caminho).

## Rodando local (desenvolvimento)

```bash
cd radar
cp .env.example .env          # DATABASE_URL=postgresql://radar:radar@localhost:5433/radar + chaves
docker compose up -d          # Postgres na porta 5433 (ou use `npm run local`, que embute o banco)
npm install
npm run db:push               # cria as tabelas
npm run db:seed               # opcional: cliente de exemplo com 4 fontes
npm run collect -- --all      # primeira coleta de todas as fontes
npm run dev                   # dashboard em http://localhost:3000
npm run worker                # em outro terminal: coleta contínua
```

Outros comandos:

```bash
npm run collect -- --source <id>   # roda uma fonte
npm run collect -- --backfill 30   # recalcula snapshots diários dos últimos 30 dias
npm test                           # testes unitários
npm run typecheck
```

## Deploy (ex.: Railway)

Mesmo repositório, dois serviços com root directory `radar/` e o `Dockerfile`:

1. **web**: comando padrão do Dockerfile (aplica o schema e sobe o Next.js).
2. **worker**: comando `npm run worker`.

Variáveis nos dois: `DATABASE_URL` e as chaves opcionais. Defina `DASHBOARD_PASSWORD` no web para proteger o painel com Basic Auth.

## Custos de referência

- Google News, GDELT, RSS, App Store, Google Play: grátis.
- YouTube: grátis dentro da cota diária (10 000 unidades; cada busca gasta 100).
- Claude Haiku 5.5 para classificar: lotes de 20 menções por chamada. Na ordem de centavos de dólar por mil menções.
- Apify: pago por uso; depende do actor.
