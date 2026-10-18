-- Délais de livraison (cf. docs/adr/0006).
--
-- Une commande n'avait aucune contrainte de temps : affectée, elle pouvait attendre des
-- heures sans que rien ne le signale. Or un restaurant (livrer 30 min après le retrait),
-- une course express (dans l'heure) et des documents (avant midi) n'ont pas les mêmes
-- exigences qu'un colis du jour.
--
-- Côté marchand : délai par défaut, suppléments express et pénalité de retard (jsonb, même
-- forme que le contrat `DeliveryTerms` du domaine). Côté commande : la règle FIGÉE à la
-- création et les échéances calculées par le serveur.

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS delivery_terms jsonb NOT NULL
    DEFAULT '{"delai":{"mode":"aucun"},"supplements":{},"penaliteRetard":0}'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delay_mode       text NOT NULL DEFAULT 'aucun',
  ADD COLUMN IF NOT EXISTS delay_minutes    integer,
  ADD COLUMN IF NOT EXISTS delay_heure      text,
  ADD COLUMN IF NOT EXISTS retrait_minutes  integer,
  ADD COLUMN IF NOT EXISTS due_at           timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_due_at    timestamptz,
  ADD COLUMN IF NOT EXISTS picked_at        timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at     timestamptz,
  ADD COLUMN IF NOT EXISTS late_minutes     integer,
  ADD COLUMN IF NOT EXISTS late_penalty     double precision,
  -- Une alerte par étape : « à risque » puis « en retard », jamais répétées à chaque passe.
  ADD COLUMN IF NOT EXISTS risk_alerted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS late_alerted_at  timestamptz;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_delay_mode_chk
    CHECK (delay_mode IN ('aucun', 'apres_retrait', 'apres_commande', 'heure_limite'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- La veille des retards ne lit que les commandes en cours qui ont une échéance.
CREATE INDEX IF NOT EXISTS orders_echeances_idx ON orders (due_at, pickup_due_at)
  WHERE status IN ('NOUVELLE', 'ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON');

-- Les remises pour retard apparaissent sur la facture du marchand.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS late_penalties integer NOT NULL DEFAULT 0;
