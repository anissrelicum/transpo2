---
name: transpo-maps-geo
description: >
  Cartographie et géospatial Transpo : cartes (Leaflet en maquette → Mapbox en prod), géofencing des
  zones, moteur de tournée réel (remplacer l'heuristique de démo), suivi GPS des livreurs, capture de
  position. À CONSULTER pour tout écran carte, zone, géofence, optimisation de tournée, ou tracking.
  Déclencheurs : "carte", "map", "leaflet", "mapbox", "zone", "géofence", "geofencing", "tournée",
  "routing", "GPS", "position", "polygone".
---

# Transpo — Cartographie & géospatial

## État maquette → cible prod
- **Maquette** : Leaflet + tuiles CartoDB (clair/sombre), marqueurs/polylignes/polygones. Suffisant pour la démo.
- **Production** : passer à **Mapbox GL** (ou Google Maps) pour un meilleur géofencing, un rendu vectoriel et l'accès à un vrai routing. Garder les **couleurs du design-system** pour les marqueurs (livreur, arrêt, commande) — cohérence visuelle (`transpo-design-system`).

## Géofencing (zones)
- Zones = **polygones** (éditeur `lot2`), rattachées à région/province/commune (données admin marocaines). Livreurs affectés par zone.
- Stocker la géométrie en **PostGIS** (extension Postgres, dans le schéma de chaque tenant) ; requêtes point-dans-polygone pour détecter **sortie de zone** (alerte PC flotte) et appartenance.
- Événements géofence (entrée/sortie/excès de vitesse) poussés en temps réel (voir `transpo-realtime`).

## Moteur de tournée (⚠️ heuristique à remplacer)
- La maquette optimise par **plus proche voisin** sur distance à vol d'oiseau (Haversine) — c'est une **démo**, pas un vrai optimiseur.
- Prod : utiliser un **moteur de routing réel** (Mapbox Optimization/Directions, OSRM, ou Google Directions) tenant compte du **temps de trajet réel**, du sens de circulation, et des fenêtres horaires client (créneaux). Distinguer clairement l'estimation démo de l'optimisation prod dans le code.

## Suivi GPS livreur
- App livreur : capture de position (y compris **arrière-plan** pendant le shift, permission demandée à l'onboarding), **throttling** des envois (batterie/réseau), file offline (`transpo-offline-sync`).
- Capture GPS à la **preuve de livraison** (coordonnées + précision).
- PC flotte : positions temps réel + télémétrie (vitesse, batterie) via `transpo-realtime`.

## Confidentialité
Le suivi public n'expose **jamais** de position précise sensible — seulement statut/ETA/ville (voir `transpo-domain` / `transpo-auth-security`).
