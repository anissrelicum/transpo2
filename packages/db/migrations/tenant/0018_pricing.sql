-- Configuration tarifaire par tenant (grille de paliers + suppléments + remise standard).
-- Lue par le moteur de devis (quote). Table à ligne unique (id = 'default').
CREATE TABLE IF NOT EXISTS pricing_config (
  id                 text PRIMARY KEY DEFAULT 'default',
  tiers              jsonb NOT NULL DEFAULT '[]'::jsonb,
  fragile_surcharge  integer NOT NULL DEFAULT 15,
  scheduled_surcharge integer NOT NULL DEFAULT 10,
  discount_rate      double precision NOT NULL DEFAULT 0.1,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
