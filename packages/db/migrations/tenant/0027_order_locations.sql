-- Localisation précise des deux points d'une course.
--
-- L'adresse était un texte libre : « derrière la mosquée, 2e rue à droite ». Au Maroc, le
-- client final envoie le plus souvent sa position par WhatsApp — un lien Google Maps, Waze
-- ou Plans — que le marchand recopiait à la main, quand il ne la perdait pas. Le livreur,
-- lui, arrivait dans le quartier et téléphonait.
--
-- On conserve donc, pour chaque point :
--   - les coordonnées (WGS84, degrés décimaux) : épingle sur la carte, distance réelle ;
--   - le lien d'ORIGINE tel qu'il a été collé : c'est lui que le livreur ouvre pour
--     naviguer (il peut porter un lieu nommé, une entrée précise que les seules
--     coordonnées ne disent pas). À défaut de lien, l'API en génère un, partageable.
-- Facultatives : les commandes antérieures n'en portent pas, la ville reste le minimum.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_lat     double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng     double precision,
  ADD COLUMN IF NOT EXISTS pickup_map_url text,
  ADD COLUMN IF NOT EXISTS drop_lat       double precision,
  ADD COLUMN IF NOT EXISTS drop_lng       double precision,
  ADD COLUMN IF NOT EXISTS drop_map_url   text;
