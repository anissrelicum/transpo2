# ADR 0007 — Itinéraires par les rues (moteur OSRM auto-hébergé)

Date : 2026-10-18 · Statut : accepté

## Contexte
La carte du livreur reliait ses arrêts en lignes droites, au travers des immeubles, avec des
durées estimées à vol d'oiseau. Le livreur ne voyait ni le vrai chemin ni le vrai temps, et le
PC flotte montrait la même approximation.

## Décision
- **Moteur OSRM auto-hébergé** (open source, données OpenStreetMap, profil voiture, extrait
  Maroc de Geofabrik), déployé dans le cluster (`deploy/homelab/osrm.yaml`). Pas de coût par
  appel ni de quota, contrairement à Google ou Mapbox. Pour un autre pays : un autre extrait.
- **`GET /v1/routing/route?points=lat,lng;…`** : tracé, distance et durée, par tronçon. Cache
  10 min par suite de points arrondis. Durées OSRM × 1,25 (ville réelle : feux, trafic,
  stationnement ; réglable par `ROUTING_DURATION_FACTOR`). Moteur indisponible → estimation en
  lignes droites marquée `source: estimation`, jamais une erreur.
- **App livreur — un seul tracé, pas une couleur par commande** : au-delà de 4 ou 5 commandes,
  des couleurs différentes se mélangent et le livreur ne sait plus laquelle suivre. Le trajet
  vers le prochain arrêt est épais, la suite de la journée est plus claire ; ramassage (carré
  violet) et livraison (goutte) se distinguent par la forme, avec une légende. En bas :
  « Journée : N arrêts · durée avec les arrêts · km ».
- **Console** : l'itinéraire restant du livreur sélectionné dans le PC flotte suit aussi les rues.

## Conséquences
~1 Go de RAM au plus pendant la préparation de la carte, ~500 Mo en service. Le guidage pas à
pas reste celui de Google Maps / Waze (bouton « Naviguer »). Mise à jour de la carte : supprimer
`/data/.pret` dans le volume OSRM et redémarrer le déploiement.
