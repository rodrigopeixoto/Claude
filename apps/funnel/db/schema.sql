-- Rode uma vez no Postgres (Neon, Supabase, Vercel Postgres...): psql "$DATABASE_URL" -f db/schema.sql
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

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
