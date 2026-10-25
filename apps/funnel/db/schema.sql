-- Rode no Postgres (Neon, Supabase, Vercel Postgres...): psql "$DATABASE_URL" -f db/schema.sql
-- Pode rodar de novo a cada versão: só cria o que falta.
CREATE TABLE IF NOT EXISTS leads (
  id                   uuid PRIMARY KEY,
  code                 text NOT NULL UNIQUE,
  token                text NOT NULL,
  status               text NOT NULL CHECK (status IN ('qualified', 'downsell', 'material')),
  answers              jsonb NOT NULL,
  area_outro           text,
  nome                 text,
  instagram            text,
  whatsapp             text,
  utm                  jsonb NOT NULL DEFAULT '{}',
  elapsed_ms           integer,
  ip                   text,
  user_agent           text,
  whatsapp_clicked_at  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Painel: etapa do atendimento e anotações
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'novo';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);

-- Visitas por dia e por tema (teste A/B claro × escuro)
CREATE TABLE IF NOT EXISTS visits (
  day    date NOT NULL,
  tema   text NOT NULL,
  count  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, tema)
);
