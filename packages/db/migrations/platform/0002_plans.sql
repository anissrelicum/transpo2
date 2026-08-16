-- Migration platform 0002 — catalogue de plans versionné, abonnements, factures plateforme.
-- Spécification : design/SPEC-PLANS-ABONNEMENTS.md
--
-- Montants en CENTIMES (suffixe `_centimes` sur chaque colonne monétaire). Le reste du
-- dépôt stocke en dirhams entiers (orders.cod, pricing.*), mais le pay-as-you-go impose
-- des prix unitaires sous le dirham (4,50 DH/commande) : l'entier en DH ne couvre pas le
-- besoin et le flottant est exclu sur des montants facturés. Cf. spec §4.6.

-- 1) Catalogue : identité commerciale stable, SANS prix.
CREATE TABLE IF NOT EXISTS platform.plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,          -- 'transporteur' — stable, jamais réutilisé
  label_fr    text NOT NULL,
  label_ar    text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  archived_at timestamptz,                   -- archivé = plus souscriptible, abonnés conservés
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2) Tarif daté. Le prix vit ici, jamais sur le plan : c'est ce qui permet de re-tarifer
--    le catalogue sans toucher au prix des abonnés déjà en place (prix gelé, spec §2).
CREATE TABLE IF NOT EXISTS platform.plan_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid NOT NULL REFERENCES platform.plans(id) ON DELETE CASCADE,
  version          integer NOT NULL,
  billing_mode     text NOT NULL CHECK (billing_mode IN ('FORFAIT', 'USAGE')),
  -- mode FORFAIT
  monthly_centimes integer NOT NULL DEFAULT 0 CHECK (monthly_centimes >= 0),
  included_orders  integer CHECK (included_orders IS NULL OR included_orders >= 0),
  overage_centimes integer CHECK (overage_centimes IS NULL OR overage_centimes >= 0),
  -- mode USAGE
  base_centimes    integer NOT NULL DEFAULT 0 CHECK (base_centimes >= 0),
  tier_mode        text NOT NULL DEFAULT 'VOLUME' CHECK (tier_mode IN ('VOLUME', 'GRADUE')),
  min_centimes     integer NOT NULL DEFAULT 0 CHECK (min_centimes >= 0),
  -- commun
  effective_from   date NOT NULL,
  effective_to     date,                     -- NULL = version courante du plan
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version)
);

-- Une seule version courante par plan, garanti en base et pas seulement applicativement.
CREATE UNIQUE INDEX IF NOT EXISTS plan_versions_current_uq
  ON platform.plan_versions (plan_id) WHERE effective_to IS NULL;

-- 3) Paliers de volume (mode USAGE). Invariants de contiguïté validés applicativement
--    (@transpo/domain → validateTiers) : Postgres ne sait pas exprimer « contigus ».
CREATE TABLE IF NOT EXISTS platform.plan_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES platform.plan_versions(id) ON DELETE CASCADE,
  from_qty        integer NOT NULL CHECK (from_qty >= 1),
  to_qty          integer CHECK (to_qty IS NULL OR to_qty >= from_qty),
  unit_centimes   integer NOT NULL CHECK (unit_centimes >= 0),
  UNIQUE (plan_version_id, from_qty)
);

-- 4) Abonnement : tenant ↔ version de tarif sur une période. L'entité qui manquait.
CREATE TABLE IF NOT EXISTS platform.subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL REFERENCES platform.plan_versions(id),  -- prix GELÉ ici
  status          text NOT NULL CHECK (status IN ('ESSAI','ACTIF','IMPAYE','SUSPENDU','RESILIE')),
  started_at      date NOT NULL,
  trial_ends_at   date,
  current_period  text NOT NULL,             -- 'YYYY-MM'
  renews_at       date,
  ended_at        date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Un seul abonnement courant par tenant.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_current_uq
  ON platform.subscriptions (tenant_id) WHERE ended_at IS NULL;

-- 5) Facture plateforme. `lines` est figé à l'émission : une facture passée reste
--    opposable même après re-tarification du catalogue (spec §6.4).
CREATE TABLE IF NOT EXISTS platform.platform_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   uuid NOT NULL REFERENCES platform.subscriptions(id),
  tenant_id         uuid NOT NULL REFERENCES platform.tenants(id),
  period            text NOT NULL,           -- 'YYYY-MM'
  number            text UNIQUE NOT NULL,    -- 'PF-2026-08-0001'
  status            text NOT NULL CHECK (status IN ('EMISE','PAYEE','ANNULEE')),
  billable_orders   integer NOT NULL DEFAULT 0,
  lines             jsonb NOT NULL,
  subtotal_centimes integer NOT NULL,
  vat_rate          integer NOT NULL,
  vat_centimes      integer NOT NULL,
  total_centimes    integer NOT NULL,
  due_date          date NOT NULL,
  paid_at           timestamptz,
  paid_method       text CHECK (paid_method IS NULL OR paid_method IN ('VIREMENT','CHEQUE','ESPECES')),
  paid_ref          text,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  -- Idempotence de la génération : rejouer une période ne duplique jamais.
  UNIQUE (subscription_id, period)
);

CREATE INDEX IF NOT EXISTS platform_invoices_period_idx ON platform.platform_invoices (period);
CREATE INDEX IF NOT EXISTS platform_invoices_tenant_idx ON platform.platform_invoices (tenant_id);
