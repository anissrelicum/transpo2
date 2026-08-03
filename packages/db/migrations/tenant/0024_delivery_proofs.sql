-- Preuves de livraison : photo et/ou signature selon le `proof_level` de la commande.
-- Les artefacts sont stockés en data URI (JPEG/PNG base64), déjà compressés côté mobile ;
-- le service borne leur taille. Une commande = au plus une preuve (rejeu idempotent).
CREATE TABLE IF NOT EXISTS delivery_proofs (
  ref         text PRIMARY KEY,
  photo       text,
  signature   text,
  captured_by text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
