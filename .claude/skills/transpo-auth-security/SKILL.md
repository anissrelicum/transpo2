---
name: transpo-auth-security
description: >
  Authentification, autorisation (RBAC), contrôle d'accès multi-tenant, journal d'audit et sécurité
  de la plateforme Transpo. À CONSULTER pour login/2FA/SSO, rôles et permissions, protéger un endpoint,
  gérer les secrets, tracer une action sensible, ou appliquer la Loi 09-08. Déclencheurs : "auth",
  "login", "2FA", "SSO", "SAML", "rôle", "permission", "RBAC", "sécurité", "secret", "audit",
  "impersonation", "session", "JWT", "09-08".
---

# Transpo — Auth & Sécurité

Règles métier des profils : `transpo-domain`. Résolution de tenant : `transpo-architecture`.

## Deux realms d'authentification distincts
1. **Utilisateurs d'un tenant** — Console transport (Admin/Dispatcher/Comptable) et Portail marchand. Identité rattachée à un tenant (schéma). JWT portant `sub`, `tenant`, `role`.
2. **Super-admin plateforme (Console SaaS)** — équipe Transpo. **Système d'auth séparé**, aucun recouvrement de permissions avec les rôles tenant. Peut agir sur les tenants (provisioning, suspension) et **s'impersonner** dans un tenant.

App livreur & client : flux dédiés (livreur = téléphone + mot de passe + onboarding permissions ; client final = sans compte, accès par code de suivi).

## Flux d'auth (maquette `lot15` = vitrine, à rendre verrouillant)
Login (e-mail + mot de passe) · mot de passe oublié · **2FA** (code 6 chiffres) · **SSO/SAML** (réservé plan Grand Compte). En prod : c'est un **vrai gate** en amont de chaque console, pas une démo.
- Mots de passe : hachage **argon2id**, jamais en clair. Rate-limiting sur login/2FA. Verrouillage progressif.
- Sessions : JWT courts + refresh token ; expiration ; révocation à la déconnexion. 2FA obligatoire configurable par tenant.

## RBAC (rôles & permissions)
- **Administrateur** : toutes les permissions du tenant.
- **Dispatcher** : Commandes, Dispatch, Chauffeurs (lecture).
- **Comptable** : Facturation, Tarification (lecture).
- **Marchand** : périmètre limité à ses propres commandes/portefeuille/factures/API.
- **Super-admin SaaS** : gestion plateforme (tenants, plans, facturation plateforme).
- Le **dernier administrateur d'un tenant ne peut pas être désactivé** (garde-fou anti-verrouillage).
- Permissions vérifiées **côté serveur** (guards NestJS), jamais seulement masquées dans l'UI.

## Contrôle d'accès multi-tenant (bloquant)
- Tenant dérivé du serveur (sous-domaine / claim JWT) → `search_path` (voir `transpo-architecture`). **Jamais** d'un paramètre client.
- Toute requête est scoping-ée au tenant du contexte. Test d'isolation obligatoire (`transpo-testing`).

## Journal d'audit (obligatoire sur actions sensibles)
Tracer **qui / quand / quoi / depuis quel tenant** pour : **impersonation** (« Se connecter en tant que » — le PRD l'exige explicitement), confirmation de fraude & suspension, déprovisioning de tenant, remboursement/transaction inverse COD, résolution d'écart de caisse, changement de rôle, régénération de clé API. Journal immuable, consultable.

## Secrets & données personnelles
- **Secrets** hors du repo (env / gestionnaire de secrets) ; `.env.example` documente les clés (voir `transpo-docs`). Clés API marchand **régénérables** ; webhooks **signés** (HMAC).
- **Loi 09-08** : opt-in explicite avant SMS/WhatsApp (canal bloqué sinon) ; **minimisation** sur le suivi public (statut/ETA/ville uniquement, jamais nom/adresse/téléphone exacts) ; page de confidentialité réelle à produire.
