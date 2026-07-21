-- Sessions de caisse (réconciliation COD par livreur et par jour).
-- theorique = COD encaissé (livré) ; declared = cash annoncé par le livreur ;
-- deposited = remis en agence. status: EN_COURS | A_DEPOSER | ECART | DEPOSE.
CREATE TABLE IF NOT EXISTS cash_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver       text NOT NULL,
  ini          text NOT NULL,
  session_date date NOT NULL,
  theorique    integer NOT NULL DEFAULT 0,
  declared     integer,
  deposited    integer NOT NULL DEFAULT 0,
  deliveries   integer NOT NULL DEFAULT 0,
  cap          integer NOT NULL DEFAULT 6000,
  status       text NOT NULL DEFAULT 'EN_COURS',
  reason       text,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Mouvements COD d'une session (détail du rapprochement pour un écart).
CREATE TABLE IF NOT EXISTS cash_movements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  ref        text NOT NULL,
  recipient  text NOT NULL,
  amount     integer NOT NULL,
  matched    boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id);
