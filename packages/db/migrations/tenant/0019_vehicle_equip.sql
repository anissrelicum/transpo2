-- Capacité et équipements des véhicules (hayon, frigo…).
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS capacity  text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}';
