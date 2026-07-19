-- Migration tenant 0004 — retours (reverse logistics) + cas de fraude COD.
CREATE TABLE IF NOT EXISTS returns (
  ref        text PRIMARY KEY,               -- = référence commande
  reason     text NOT NULL,
  attempts   integer NOT NULL DEFAULT 1,
  status     text NOT NULL DEFAULT 'A_TRAITER', -- A_TRAITER|REPLANIFIE|RETOUR_HUB|A_RENDRE|RENDU|SOUFFRANCE
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fraud_cases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver     text NOT NULL,
  amount     integer NOT NULL DEFAULT 0,
  signals    text[] NOT NULL DEFAULT '{}',
  score      integer NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'OUVERT', -- OUVERT|ENQUETE|BLANCHI|CONFIRME
  summary    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
