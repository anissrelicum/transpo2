-- Migration tenant 0013 — zones : région/province + polygone (carte Dispatch fidèle).
ALTER TABLE zones ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS polygon jsonb;  -- [[lat,lng], ...]
