-- Migration tenant 0010 — flotte temps réel & géofencing (T16).
CREATE TABLE IF NOT EXISTS driver_positions (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver text NOT NULL,
  lat    double precision NOT NULL,
  lng    double precision NOT NULL,
  at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_positions_driver_at ON driver_positions (driver, at DESC);

-- Zone géo assignée à un livreur : alerte si sa dernière position en sort.
CREATE TABLE IF NOT EXISTS geofences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver     text NOT NULL,
  name       text NOT NULL,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  radius_m   integer NOT NULL DEFAULT 5000
);
