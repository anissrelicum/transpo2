-- Migration tenant 0000 — appliquée DANS chaque schéma de tenant (via search_path).
CREATE TABLE IF NOT EXISTS orders (
  ref          text PRIMARY KEY,
  code         text NOT NULL,
  status       text NOT NULL,
  merchant     text,
  from_city    text NOT NULL,
  to_city      text NOT NULL,
  driver       text,
  cod          integer NOT NULL DEFAULT 0,
  cod_paid     boolean NOT NULL DEFAULT false,
  size         text,
  proof_level  text NOT NULL DEFAULT 'photo_signature',
  created_at   timestamptz NOT NULL DEFAULT now()
);
