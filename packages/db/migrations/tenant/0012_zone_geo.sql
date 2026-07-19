-- Migration tenant 0012 — géométrie de zone (centre) pour la carte Dispatch.
ALTER TABLE zones ADD COLUMN IF NOT EXISTS center_lat double precision;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS center_lng double precision;
