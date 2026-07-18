---
name: transpo-realtime
description: >
  Temps réel Transpo : WebSocket/SSE pour le suivi live (dispatch, PC flotte, tracking client),
  la propagation des changements de statut, le chat dispatch↔livreur et les notifications push.
  Canaux isolés par tenant. À CONSULTER pour toute fonctionnalité live/temps réel, push, ou chat.
  Déclencheurs : "temps réel", "realtime", "websocket", "socket", "live", "push", "notification",
  "chat", "tracking", "SSE".
---

# Transpo — Temps réel

## Où le temps réel est nécessaire (déjà maquetté)
- **PC flotte** (`lot14`) : positions livreurs, télémétrie, événements géofence, alertes sortie de zone.
- **Dispatch** (`lot2`) : carte live, nouvelles commandes à affecter, replanifications client.
- **Suivi client / marchand** : progression de statut poussée (au lieu de polling).
- **Chat** : dispatch ↔ livreur (`lot3`), et client ↔ livreur (`lot11`).
- **Notifications** : nouvelles missions, changement d'adresse, annulation, rappel COD, alerte pause EU 561.

## Technique
- **NestJS Gateway** (Socket.IO ou WS natif) côté back ; SSE acceptable pour du push unidirectionnel simple (suivi client).
- **Auth à la connexion** : le socket valide le **JWT + tenant** avant d'ouvrir la session (voir `transpo-auth-security`).
- **Isolation par tenant** : les rooms/canaux sont **namespacés par tenant** (`tenant:<x>:fleet`, `tenant:<x>:order:<ref>`). Un client d'un tenant ne reçoit **jamais** les événements d'un autre.
- **Présence** : état en ligne/hors ligne des livreurs (PC flotte, chat).
- **Reconnexion** : backoff + ressynchronisation de l'état au retour (cohérent avec `transpo-offline-sync` côté livreur).

## Push mobile
- Notifications push (Expo Push / FCM / APNs) pour le livreur (missions/alertes) et le client (arrivée imminente). Respecter le **consentement** (`transpo-auth-security`, Loi 09-08) pour les canaux qui le requièrent.

## Cohérence avec le reste
- Les payloads réutilisent les **enums/contrats** partagés (`transpo-api`) — pas de format ad hoc.
- Les événements géofence viennent du géospatial (`transpo-maps-geo`).
- Les statuts poussés suivent le **cycle de vie** canonique (`transpo-domain`).
