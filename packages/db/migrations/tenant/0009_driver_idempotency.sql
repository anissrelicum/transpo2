-- Migration tenant 0009 — app livreur (T8/T9).
-- Lien utilisateur DRIVER → nom du livreur (= orders.driver / drivers.name).
ALTER TABLE users ADD COLUMN IF NOT EXISTS driver text;

-- Idempotence offline : rejeu d'une même requête (Idempotency-Key) => réponse mémorisée,
-- sans double application de l'effet (cf. transpo-offline-sync).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        text PRIMARY KEY,
  response   jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
