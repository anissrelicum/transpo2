-- Identité légale et régionale du tenant (écran Paramètres entreprise).
CREATE TABLE IF NOT EXISTS company_settings (
  id           text PRIMARY KEY DEFAULT 'default',
  legal_name   text,
  ice          text,
  rc           text,
  address      text,
  currency     text NOT NULL DEFAULT 'MAD',
  timezone     text NOT NULL DEFAULT 'Africa/Casablanca',
  default_lang text NOT NULL DEFAULT 'fr',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
