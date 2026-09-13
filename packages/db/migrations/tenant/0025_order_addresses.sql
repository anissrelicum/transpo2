-- Coordonnées de retrait et de livraison d'une commande.
--
-- L'assistant de création demandait depuis le début, sur deux écrans entiers, le contact,
-- le téléphone, l'adresse et les notes du point de retrait comme du point de livraison —
-- champs marqués « requis ». Aucun n'était transmis ni stocké : la recette (TC-F01) a
-- montré que ces deux tiers de l'assistant partaient à la poubelle à chaque création.
--
-- Une course de livraison va d'une adresse à une autre : la ville seule ne suffit ni au
-- livreur, ni au suivi client, ni à la preuve. Ces colonnes ferment le trou.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_contact text,
  ADD COLUMN IF NOT EXISTS pickup_phone   text,
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_notes   text,
  ADD COLUMN IF NOT EXISTS drop_contact   text,
  ADD COLUMN IF NOT EXISTS drop_phone     text,
  ADD COLUMN IF NOT EXISTS drop_address   text,
  ADD COLUMN IF NOT EXISTS drop_notes     text,
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS vehicle_type   text;
