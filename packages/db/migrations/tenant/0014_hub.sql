-- Migration tenant 0014 — tri en hub : phase de traitement d'un colis dans le hub.
-- arrive (scanné en entrée) | trier | quai (prêt au transfert). NULL = pas dans le hub.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hub_phase text;
