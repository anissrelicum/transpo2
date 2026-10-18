-- Affectation automatique équitable avec acceptation livreur (cf. docs/adr/0004).
--
-- Jusqu'ici, aucune commande ne partait seule : le dispatch se contentait de classer les
-- livreurs pour qu'un humain clique. Ce lot ajoute un interrupteur d'entreprise qui confie
-- les commandes nouvelles à un automate ÉQUITABLE (le moins chargé au regard de sa capacité
-- du jour, dans une zone qui couvre le point de retrait), avec une PROPOSITION que le
-- livreur accepte ou refuse dans un délai fixé. Le dispatcher ne traite plus que les
-- exceptions — les commandes que l'automate n'a pas pu placer, avec leur motif.
--
-- Le statut de la commande N'EST PAS modifié par la proposition : elle reste `NOUVELLE`
-- tant que personne n'a accepté. L'énumération canonique des statuts (packages/domain)
-- est partagée par toutes les apps et le suivi public ; la proposition vit à côté, dans
-- `order_offers`.
--
-- Migration rejouée à chaque `migrate` : tout est idempotent.

-- Réglages d'entreprise : interrupteur (désactivé par défaut), délai d'acceptation, capacité
-- journalière par défaut d'un livreur.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS auto_dispatch          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_timeout_min      integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS default_daily_capacity integer NOT NULL DEFAULT 20;

DO $$ BEGIN
  ALTER TABLE company_settings ADD CONSTRAINT company_settings_offer_timeout_chk
    CHECK (offer_timeout_min BETWEEN 1 AND 60);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE company_settings ADD CONSTRAINT company_settings_daily_capacity_chk
    CHECK (default_daily_capacity BETWEEN 1 AND 500);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Capacité propre à un livreur ; NULL = capacité par défaut de l'entreprise.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS daily_capacity integer;
DO $$ BEGIN
  ALTER TABLE drivers ADD CONSTRAINT drivers_daily_capacity_chk
    CHECK (daily_capacity IS NULL OR daily_capacity BETWEEN 1 AND 500);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Commande :
--  · `assigned_at` — instant de l'affectation, seule base honnête pour compter « les
--    commandes affectées aujourd'hui » (la date de création ne dit pas quand le livreur l'a
--    prise). NULL pour les commandes antérieures : elles ne pèsent pas sur la capacité.
--  · `dispatch_exception` — motif pour lequel l'automate n'a pas pu placer la commande
--    (AUCUN_LIVREUR_DISPONIBLE | ZONE_NON_COUVERTE | CAPACITE_ATTEINTE | REFUSEE_PAR_TOUS).
--    Effacé dès qu'un livreur est affecté ou qu'une relance est demandée.
--  · `dispatch_round` — numéro de tentative. Une relance ouvre un nouveau tour : les refus
--    du tour précédent ne l'excluent plus (sinon « relancer » reproduirait l'exception).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_at           timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_exception    text,
  ADD COLUMN IF NOT EXISTS dispatch_exception_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_round        integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_dispatch_exception_chk CHECK (
    dispatch_exception IS NULL OR dispatch_exception IN
      ('AUCUN_LIVREUR_DISPONIBLE', 'ZONE_NON_COUVERTE', 'CAPACITE_ATTEINTE', 'REFUSEE_PAR_TOUS')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS orders_driver_assigned_at_idx ON orders (driver, assigned_at);
CREATE INDEX IF NOT EXISTS orders_dispatch_exception_idx ON orders (dispatch_exception)
  WHERE dispatch_exception IS NOT NULL;

-- Propositions faites aux livreurs. Une ligne par (commande, livreur, tour).
CREATE TABLE IF NOT EXISTS order_offers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref          text        NOT NULL REFERENCES orders(ref) ON DELETE CASCADE,
  driver       text        NOT NULL,
  round        integer     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'PROPOSEE',
  -- Pourquoi lui : charge/capacité et distance au moment du choix (affiché au journal).
  reason       text,
  offered_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  responded_at timestamptz,
  CONSTRAINT order_offers_status_chk
    CHECK (status IN ('PROPOSEE', 'ACCEPTEE', 'REFUSEE', 'EXPIREE', 'ANNULEE'))
);

-- Garde-fou de concurrence : AU PLUS UNE proposition en cours par commande, quelle que soit
-- la réplique d'API qui la crée. Une seconde insertion concurrente échoue au lieu de
-- proposer la même course à deux livreurs.
CREATE UNIQUE INDEX IF NOT EXISTS order_offers_one_pending_idx
  ON order_offers (ref) WHERE status = 'PROPOSEE';
CREATE INDEX IF NOT EXISTS order_offers_expiry_idx
  ON order_offers (expires_at) WHERE status = 'PROPOSEE';
CREATE INDEX IF NOT EXISTS order_offers_driver_idx ON order_offers (driver, status);
CREATE INDEX IF NOT EXISTS order_offers_ref_round_idx ON order_offers (ref, round);
