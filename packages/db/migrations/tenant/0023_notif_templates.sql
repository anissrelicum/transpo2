-- Modèles de notification éditables par tenant (le catalogue @transpo/domain sert de valeur d'origine).
CREATE TABLE IF NOT EXISTS notif_templates (
  event         text PRIMARY KEY,
  fr            text NOT NULL,
  ar            text NOT NULL,
  transactional boolean NOT NULL DEFAULT true,
  active        boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
