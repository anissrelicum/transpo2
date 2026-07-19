-- Migration tenant 0006 — suivi public & notation client (T15).
-- Notation post-livraison laissée par le client final via le lien de suivi public.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating_comment text;
