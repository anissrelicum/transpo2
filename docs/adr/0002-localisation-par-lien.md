# ADR 0002 — Localisation des points de course par lien + coordonnées

- **Statut** : proposé (à valider en revue)
- **Date** : 2026-10
- **Contexte** : l'adresse d'un point de retrait / livraison était un texte libre. Au Maroc, le client final transmet sa position au marchand par WhatsApp, sous forme de **lien** (Google Maps, souvent un lien court `maps.app.goo.gl`, plus rarement Waze, Plans ou OpenStreetMap). Le marchand le recopiait à la main ou le perdait ; le livreur arrivait dans le quartier et téléphonait.

## Décision

1. **Données** (migration tenant `0027_order_locations.sql`, idempotente) : par point, `*_lat`, `*_lng` (WGS84, `double precision`) et `*_map_url` (le lien **d'origine**, tel que collé). Champs facultatifs : la ville reste le minimum, l'adresse texte reste facultative côté API.
2. **Lecture du lien** (`apps/api/src/geo/lien-carte.ts`, pur, testé) : formats Google (`!3dLAT!4dLNG`, `?q=`, `?query=`, `?ll=`, `/maps/search/lat,lng`, `/maps/place/lat,lng` ou DMS, `/maps/dir/…` → destination, `@lat,lng,z`), Plans (`?ll=`, `?q=`, `coordinate=`, `?address=` → géocodage), Waze (`ll=`, `to=ll.`), OSM (`?mlat&mlon`, `#map=z/lat/lng`), coordonnées brutes (`33.5731, -7.5898`, `geo:`, DMS). Préférence : lieu désigné (`!3d!4d`) > point explicite > cadrage de la vue (`@`, `#map=`).
3. **Liens courts** (`resolution-lien.ts`) : `POST /v1/geo/resolve-link {url, lang}` suit les redirections **à la main**, et lit la position dans l'URL de destination sans même la contacter quand elle y figure. En dernier recours : motifs fiables dans le HTML (≤ 512 Kio), puis géocodage du nom du lieu.
4. **Livreur** : `/v1/driver/missions` et `/v1/driver/tour` exposent coordonnées et lien ; l'app ouvre le lien d'origine (`Linking.openURL`), puis `geo:` / Plans, puis Google Maps web. Le téléphone du destinataire reste retiré des deux endpoints.
5. **Lien généré** : coordonnées sans lien (épingle posée à la main) → `https://www.google.com/maps/search/?api=1&query=lat,lng` (format « Maps URLs », sans clé). Un lien d'un hôte inconnu qui contient des coordonnées : position gardée, lien **remplacé** par ce lien généré (on n'envoie pas au livreur un lien arbitraire).
6. **Devis** : deux épingles → distance = haversine × `ROAD_FACTOR` (1,3, `@transpo/domain`) au lieu de la distance de ville à ville. Estimation de devis, pas un itinéraire (le routing réel reste à faire, cf. skill `transpo-maps-geo`).

## Sécurité — anti-SSRF
L'API va chercher une URL fournie par l'utilisateur. Garde-fous, vérifiés **avant chaque requête, redirections comprises** :
- liste blanche d'hôtes : `maps.app.goo.gl`, `goo.gl` (chemin `/maps` seulement), `g.co`, `maps.google.<tld>`, `(www.)google.<tld>/maps…`, `maps.apple.com`, `maps.apple`, `waze.com`, `www.waze.com`, `ul.waze.com`, `openstreetmap.org`, `www.openstreetmap.org`, `osm.org` ; tout autre hôte (IP, `localhost`, nom interne, autre domaine) → `HOTE_REFUSE` ;
- `http`/`https` uniquement, ports standards, pas d'identifiants dans l'URL ;
- 5 redirections au plus, une échéance unique de 5 s pour toute la chaîne, 512 Kio lus au plus ;
- `consent.google.com` n'est jamais contacté : sa destination est lue dans `continue`.
Endpoint réservé aux rôles qui créent des commandes (ADMIN, DISPATCHER, COMPTABLE, MERCHANT), derrière le `TenantGuard` (coupé pour un espace suspendu).

## Nominatim (géocodage OpenStreetMap)
Adresse détectée (inverse) et géocodage de dernier recours (`?address=`, nom de lieu). **Best-effort** : délai 3 s, un échec ne fait jamais échouer `resolve-link`. Politique d'usage du service public respectée : `User-Agent` identifiant (`NOMINATIM_USER_AGENT`), 1 requête/s au plus par instance (file sérialisée), cache mémoire (500 entrées), une requête par geste utilisateur. Gros volumes → instance auto-hébergée (`NOMINATIM_URL`) ; `NOMINATIM_URL=` (vide) désactive.

## Conséquences
- ✅ Un collage suffit ; le livreur navigue d'un geste vers le point exact que le client a désigné.
- ✅ Testé : parseur et résolveur (fetch simulé, dont refus SSRF), validation, intégration API, Playwright.
- ⚠️ Les pages Google sont rendues en JavaScript : pour une recherche **textuelle** sans coordonnées, la vignette `staticmap?center=` et `APP_INITIALIZATION_STATE` portent le cadrage par défaut déduit de l'IP du serveur, pas le lieu — elles sont volontairement ignorées (constaté : « Mosquée Hassan II » y tombait à Bouskoura). On géocode alors le nom du lieu, signalé « position approximative » dans l'interface.
- ⚠️ Les formats de liens Google évoluent : un lien non reconnu renvoie une erreur explicite, et l'épingle reste plaçable à la main.
- ⚠️ La position du domicile est une donnée personnelle (loi 09-08) : incluse dans l'export, effacée par l'anonymisation ; jamais exposée par le suivi public.

## Alternatives écartées
- **API Google Geocoding/Places** : clé payante, conditions d'usage restrictives (affichage hors carte Google), dépendance fournisseur.
- **Suivre les redirections avec `redirect: 'follow'`** : impossible de vérifier chaque saut — porte ouverte au SSRF.
- **Résoudre le lien à la création de la commande** : appel réseau dans une écriture métier ; le client résout d'abord (`resolve-link`), la création valide seulement.
