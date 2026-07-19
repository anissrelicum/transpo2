-- Migration tenant 0001 — utilisateurs d'un tenant (Console transport / marchand).
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL,       -- ADMIN | DISPATCHER | COMPTABLE | MERCHANT
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
