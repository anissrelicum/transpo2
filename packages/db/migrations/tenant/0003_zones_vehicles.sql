-- Migration tenant 0003 — zones (dispatch) + véhicules (flotte).
CREATE TABLE IF NOT EXISTS zones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fr    text NOT NULL,
  name_ar    text,
  color      text NOT NULL DEFAULT 'indigo',
  commune    text,
  drivers    text[] NOT NULL DEFAULT '{}',   -- initiales des livreurs affectés
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate      text UNIQUE NOT NULL,           -- format marocain NNNN-L-NN
  type       text NOT NULL,                  -- Moto | Voiture | Fourgon | Camion
  city       text,
  state      text NOT NULL DEFAULT 'ACTIF',  -- ACTIF | MAINTENANCE | HORS_SERVICE
  insurance_due text,                        -- échéance assurance (YYYY-MM-DD)
  ct_due        text,                        -- échéance contrôle technique (YYYY-MM-DD)
  created_at timestamptz NOT NULL DEFAULT now()
);
