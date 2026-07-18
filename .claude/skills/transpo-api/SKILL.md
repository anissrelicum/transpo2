---
name: transpo-api
description: >
  Contrats d'API et de données Transpo : enums partagés (STATUS, proof_level…), endpoints REST
  (commandes, suivi, dispatch, cash, tenants…), webhooks signés, résolution de tenant, pagination
  et filtres. À CONSULTER pour définir/consommer un endpoint, un DTO, un webhook, le client API,
  ou aligner front et back. Déclencheurs : "endpoint", "API", "route", "DTO", "webhook", "contrat",
  "payload", "proof_level", "pagination", "filtre".
---

# Transpo — Contrats d'API & de données

Règles métier : voir `transpo-domain`. Résolution de tenant & schema-per-tenant : voir `transpo-architecture`.

## Principes
- **Types partagés** dans `packages/domain` (enums) et `packages/api-client` (DTO), importés par le back (NestJS) et les fronts → une seule définition.
- **Tenant** résolu côté serveur (sous-domaine / claim JWT), jamais depuis un champ client. Pas de `tenant_id` dans les payloads clients.
- **REST** versionné sous `/v1`. JSON. Erreurs normalisées `{ code, message, details? }`.
- **Idempotence** (offline livreur) : header `Idempotency-Key` sur les actions mutantes (statut, preuve, COD) → rejeu sans doublon.

## Enums canoniques (ne jamais diverger)
- `OrderStatus` : `PROGRAMMEE | NOUVELLE | ASSIGNEE | RETRAIT | RECUPEREE | LIVRAISON | LIVREE | ECHOUEE | RETOUR | ANNULEE`.
- `proof_level` : `aucune | photo | signature | photo_signature` — **`photo_signature` est la valeur canonique** (bannir `photo_sig`).
- `parcel.size` : `Petit | Moyen | Grand | Très grand`.
- `cash_session.status`, `return.status`, `fraud_case.status`, `billing_mode` : voir `transpo-domain`.

## Exemple — création de commande (déjà présent dans la maquette marchand)
`POST /v1/orders`
```json
{
  "pickup":  { "contact": "Boutique Zellige", "phone": "+212522471803", "address": "14 rue Ibn Batouta, Maârif", "city": "Casablanca" },
  "dropoff": { "contact": "Salma Idrissi", "phone": "+212661228490", "address": "8 avenue Hassan II, Agdal", "city": "Casablanca" },
  "parcel":  { "size": "Moyen", "cod_amount": 1250 },
  "proof_level": "photo_signature"
}
```
Réponses : `201` créé (retourne `ref` + `code` de suivi 8 car.), `422` validation.

## Familles d'endpoints (à cadrer avec le domaine)
- **Commandes** : CRUD, `POST /orders/:ref/assign`, `/advance` (statut suivant), `/collect-cod`, `/cancel`. Filtres : statut, ville, marchand, livreur, date + **pagination** (`?page`, `?pageSize`).
- **Suivi public** : `GET /v1/tracking/:code` — expose **uniquement** statut/ETA/ville/COD (jamais nom/adresse/téléphone exacts).
- **Dispatch** : livreurs géolocalisés, suggestion (score), zones (polygones).
- **Cash** : sessions, dépôt, reversement marchand, remboursement (transaction inverse tracée).
- **Tenants (SaaS)** : provisioning (crée schéma + tenant), suspend/reactivate/deprovision, plans, factures plateforme.
- **Auth** : login, 2FA, SSO/SAML (Grand Compte).

## Webhooks signés (marchand)
Événements : `order.assigned`, `order.delivered`, `order.failed`. Signature HMAC dans l'en-tête ; journal des livraisons + retries. Le marchand gère ses URLs et sa clé API (régénérable).

## Consentement (Loi 09-08)
Tout envoi SMS/WhatsApp vérifie l'opt-in du destinataire côté serveur avant l'appel au provider. Endpoint de gestion du consentement + journal d'envois.
