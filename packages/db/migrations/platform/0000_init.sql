-- Migration platform 0000 — schéma global + table des tenants.
CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  city        text,
  plan        text NOT NULL DEFAULT 'Essai',
  status      text NOT NULL DEFAULT 'ESSAI',
  created_at  timestamptz NOT NULL DEFAULT now()
);
