-- Reversements COD : cash encaissé pour le compte du marchand, à lui reverser.
-- La commission de l'opérateur est prise sur la facture de livraison (séparément).
CREATE TABLE IF NOT EXISTS payouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant     text NOT NULL,
  period       text NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  cod_amount   integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'EN_ATTENTE',
  method       text,
  reference    text,
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant, period)
);
