-- Migration tenant 0002 — livreurs du tenant (pour dispatch/assignation).
CREATE TABLE IF NOT EXISTS drivers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  city       text,
  vehicle    text,           -- Moto | Voiture | Fourgon
  available  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
