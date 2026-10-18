-- Fiche marchand et conditions tarifaires par marchand (cf. docs/adr/0003).
--
-- Un marchand n'existait jusqu'ici que comme une CHAÎNE : `orders.merchant`, `users.merchant`
-- (compte du portail), `invoices.merchant`, `payouts.merchant`, `merchant_billing.merchant`.
-- Aucun endroit où porter ce qui a été négocié avec lui. Or un transporteur ne facture pas
-- tous ses marchands de la même façon : grille de distance pour l'un, remise sur la grille
-- pour un autre, forfait par livraison pour un troisième — et une commission COD négociée.
--
-- `name` reste la clé de rattachement : c'est la même valeur que les colonnes texte
-- ci-dessus, qu'on ne convertit pas en clé étrangère (historique, et le nom sert de scope
-- au portail marchand via le claim `merchant` du JWT). Il n'est donc pas modifiable.
--
-- Migration rejouée à chaque `migrate` : tout est idempotent.
CREATE TABLE IF NOT EXISTS merchants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,
  legal_name      text,
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  tax_id          text,              -- ICE / identifiant fiscal, texte libre
  pricing_mode    text NOT NULL DEFAULT 'standard',
  discount_rate   double precision,  -- fraction (0,1 = −10 %), mode « remise » uniquement
  flat_price      double precision,  -- DH HT par livraison, mode « forfait » uniquement
  commission_rate double precision,  -- fraction ; NULL = taux de l'entreprise (pricing_config)
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchants_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT merchants_pricing_mode_chk CHECK (pricing_mode IN ('standard', 'remise', 'forfait')),
  -- Chaque mode porte exactement le paramètre qui le définit, et aucun autre : pas de
  -- forfait « dormant » qui se réveillerait au prochain changement de mode.
  CONSTRAINT merchants_pricing_consistency_chk CHECK (
    (pricing_mode = 'standard' AND discount_rate IS NULL AND flat_price IS NULL)
    OR (pricing_mode = 'remise' AND discount_rate IS NOT NULL AND discount_rate > 0 AND discount_rate < 1 AND flat_price IS NULL)
    OR (pricing_mode = 'forfait' AND flat_price IS NOT NULL AND flat_price > 0 AND discount_rate IS NULL)
  ),
  CONSTRAINT merchants_commission_chk CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1))
);

-- Reprise de l'existant : une fiche par nom de marchand déjà connu, aux conditions
-- standard (grille + commission de l'entreprise) — exactement ce qui s'appliquait
-- jusqu'ici. Le nom est repris TEL QUEL (pas de btrim) : c'est la clé de jointure.
INSERT INTO merchants (name)
SELECT DISTINCT s.m FROM (
  SELECT merchant AS m FROM orders
  UNION SELECT merchant FROM users
  UNION SELECT merchant FROM invoices
  UNION SELECT merchant FROM payouts
  UNION SELECT merchant FROM merchant_billing
) s
WHERE s.m IS NOT NULL AND btrim(s.m) <> ''
ON CONFLICT (name) DO NOTHING;

-- Prix figé à la création de la commande. La facture le reprend tel quel : modifier la
-- grille ou les conditions d'un marchand ne réécrit pas le prix des courses déjà passées.
-- NULL pour les commandes antérieures (la facturation les recalcule à la grille).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fragile          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_mode     text,
  ADD COLUMN IF NOT EXISTS distance_km      double precision,
  ADD COLUMN IF NOT EXISTS price_base       double precision,
  ADD COLUMN IF NOT EXISTS price_surcharges double precision,
  ADD COLUMN IF NOT EXISTS price_ht         double precision,
  ADD COLUMN IF NOT EXISTS price_vat        double precision,
  ADD COLUMN IF NOT EXISTS price_ttc        double precision;
