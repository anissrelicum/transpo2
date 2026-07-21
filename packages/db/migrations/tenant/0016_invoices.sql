-- Factures marchand : facturation du service de livraison.
-- deliveries_amount = montant livraisons HT ; commission = 15 % ; net_ht = montant − commission ;
-- tva = 20 % du net ; cod_collected = COD encaissé (informatif, reversé au marchand).
CREATE TABLE IF NOT EXISTS invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref               text NOT NULL UNIQUE,
  merchant          text NOT NULL,
  period            text NOT NULL,
  orders_count      integer NOT NULL DEFAULT 0,
  deliveries_amount integer NOT NULL DEFAULT 0,
  cod_collected     integer NOT NULL DEFAULT 0,
  commission        integer NOT NULL DEFAULT 0,
  net_ht            integer NOT NULL DEFAULT 0,
  tva               integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'BROUILLON',
  dispute_amount    integer,
  dispute_note      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Mode de facturation par marchand (prépayé / postpayé), persisté côté serveur.
CREATE TABLE IF NOT EXISTS merchant_billing (
  merchant text PRIMARY KEY,
  mode     text NOT NULL DEFAULT 'prepaid'
);
