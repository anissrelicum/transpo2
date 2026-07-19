-- Migration tenant 0007 — tournées (T7).
-- Une tournée regroupe des commandes assignées à un livreur en une séquence d'arrêts.
CREATE TABLE IF NOT EXISTS tournees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver     text NOT NULL,
  zone       text,
  day        text NOT NULL,                       -- date planifiée (YYYY-MM-DD)
  status     text NOT NULL DEFAULT 'PLANIFIEE',   -- PLANIFIEE | EN_COURS | CLOTUREE
  stops      text[] NOT NULL DEFAULT '{}',        -- refs de commandes, dans l'ordre
  created_at timestamptz NOT NULL DEFAULT now()
);
