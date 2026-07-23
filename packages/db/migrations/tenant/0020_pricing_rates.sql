-- Commission plateforme et TVA deviennent configurables par tenant (pilotées depuis
-- l'écran Paramètres, appliquées à la cascade tarifaire et à la facturation marchand).
ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS commission_rate double precision NOT NULL DEFAULT 0.15;
ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS vat_rate double precision NOT NULL DEFAULT 0.20;
