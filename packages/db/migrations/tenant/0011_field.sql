-- Migration tenant 0011 — livreur annexes (T10) : incidents & support.
CREATE TABLE IF NOT EXISTS incidents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver     text NOT NULL,
  ref        text,                            -- commande concernée (optionnel)
  type       text NOT NULL,
  note       text,
  status     text NOT NULL DEFAULT 'OUVERT',  -- OUVERT | TRAITE
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver     text NOT NULL,                   -- fil de discussion par livreur
  sender     text NOT NULL,                   -- 'driver' | 'ops'
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
