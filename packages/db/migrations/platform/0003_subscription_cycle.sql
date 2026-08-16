-- Migration platform 0003 — de quoi faire tourner le cycle d'abonnement (spec §5, §7).
--
-- Trois manques dans le modèle 0002, révélés en implémentant la machine à états :
--   · `past_due_since` : le délai de grâce se compte depuis l'entrée en impayé. En L2 c'est
--     la fin d'essai, en L3 ce sera la date d'échéance de la facture — d'où une colonne
--     dédiée plutôt qu'un calcul refait à chaque source.
--   · `next_plan_version_id` : un changement de plan prend effet à la prochaine échéance.
--     Le stocker sur l'abonnement courant évite une seconde ligne, que l'index partiel
--     `subscriptions_current_uq` interdirait de toute façon.
--   · `status_reason` : une résiliation ou une suspension manuelle se justifie, et le motif
--     doit être lisible dans la console, pas seulement dans le journal d'audit.
--     (« status_ » et non « ended_ » : il porte aussi le motif d'une suspension, qui ne
--     termine pas l'abonnement.)

ALTER TABLE platform.subscriptions
  ADD COLUMN IF NOT EXISTS past_due_since       date,
  ADD COLUMN IF NOT EXISTS next_plan_version_id uuid REFERENCES platform.plan_versions(id),
  ADD COLUMN IF NOT EXISTS status_reason         text;

-- Le cycle balaie par statut et par date : ces deux index évitent un seq scan par exécution.
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON platform.subscriptions (status)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS subscriptions_renews_idx ON platform.subscriptions (renews_at)
  WHERE ended_at IS NULL;
