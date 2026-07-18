-- Transpo — initialisation Postgres : multi-tenant SCHEMA-PER-TENANT
-- Exécuté automatiquement au 1er démarrage du conteneur postgres.
-- Démontre : 1 schéma "platform" (global) + 1 schéma par tenant (workspace = schéma = tenant).

-- ============ Schéma global de la plateforme ============
CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE platform.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,          -- = nom du schéma (tenant_<slug>)
  name        text NOT NULL,
  city        text,
  plan        text NOT NULL DEFAULT 'Essai',
  status      text NOT NULL DEFAULT 'ESSAI', -- ACTIF | ESSAI | SUSPENDU | IMPAYÉ
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============ Gabarit : crée un schéma de tenant + ses tables ============
-- En prod, ce SQL est joué par le provisioning (Console SaaS) via une migration paramétrée.
CREATE OR REPLACE FUNCTION platform.provision_tenant(p_slug text) RETURNS void AS $$
DECLARE s text := 'tenant_' || p_slug;
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', s);
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.orders (
      ref         text PRIMARY KEY,
      code        text NOT NULL,
      status      text NOT NULL,
      merchant    text,
      from_city   text,
      to_city     text,
      driver      text,
      cod         integer NOT NULL DEFAULT 0,
      cod_paid    boolean NOT NULL DEFAULT false,
      size        text,
      proof_level text NOT NULL DEFAULT 'photo_signature',
      created_at  timestamptz NOT NULL DEFAULT now()
    )$f$, s);
END;
$$ LANGUAGE plpgsql;

-- ============ Deux tenants de démonstration (prouvent l'isolation) ============
SELECT platform.provision_tenant('casaexpress');
SELECT platform.provision_tenant('atlas');

INSERT INTO platform.tenants (slug, name, city, plan, status) VALUES
  ('casaexpress', 'CasaExpress', 'Casablanca', 'Transporteur', 'ACTIF'),
  ('atlas',       'Atlas Courier', 'Marrakech', 'TPE Coursier', 'ACTIF');

-- Seed CasaExpress
INSERT INTO tenant_casaexpress.orders (ref, code, status, merchant, from_city, to_city, driver, cod, cod_paid, size) VALUES
  ('CMD-20260712-014', 'A7K2M9QX', 'LIVRAISON', 'Boutique Zellige', 'Casablanca', 'Casablanca', 'Youssef Benali', 1250, false, 'Moyen'),
  ('CMD-20260712-013', 'B3P8K1LM', 'NOUVELLE',  'Atlas Cosmetics',  'Rabat',      'Salé',       NULL,             480,  false, 'Petit');

-- Seed Atlas (données distinctes → l'isolation doit empêcher de les voir depuis CasaExpress)
INSERT INTO tenant_atlas.orders (ref, code, status, merchant, from_city, to_city, driver, cod, cod_paid, size) VALUES
  ('CMD-20260712-900', 'Z9Q1M4KP', 'RECUPEREE', 'Riad Déco', 'Marrakech', 'Marrakech', 'Karim El Amrani', 0, false, 'Grand');
