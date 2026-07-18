---
name: transpo-domain
description: >
  Règles métier et langage ubiquitaire de la plateforme de livraison Transpo (Maroc).
  Source unique de vérité pour tout dev touchant : commandes, statuts, dispatch, COD/caisse,
  reversement, retours, fraude, tournées, flotte (EU 561), facturation, tarification, tenants.
  À CONSULTER avant d'implémenter toute logique métier, valider un statut, calculer un prix,
  gérer du cash, ou modéliser une entité. Déclencheurs : "commande", "statut", "COD", "caisse",
  "retour", "fraude", "tarif", "commission", "tenant", "livreur", "EU 561", "Loi 09-08".
---

# Transpo — Domaine métier (langage ubiquitaire)

Réf. complète : `PRD-00-Vue-Ensemble.md` §4-5 et fiches `PRD-01..06`. Ce skill en est le condensé opérationnel. **En cas de doute, le PRD prime ; ne jamais réinventer une règle.**

## Personas (6)
Administrateur, Dispatcher (partagent la Console transport, permissions différentes), Marchand, Livreur (mobile), Client final (sans compte), Super-Admin SaaS (exploitant, gère les tenants).

## Cycle de vie d'une commande (identique partout : mobile, console, suivi public)
```
PROGRAMMEE → NOUVELLE → ASSIGNEE → RETRAIT → RECUPEREE → LIVRAISON → LIVREE
                                                 ↘ ECHOUEE → RETOUR
                                                 ↘ ANNULEE
```
Chaque statut a un libellé FR + AR + couleur figée (voir `transpo-i18n` pour `STATUS_AR`). Enum canonique partagée front/back (voir `transpo-api`). **Ne jamais** dupliquer cet enum par écran.

## Règles transverses (invariants)
1. **Devise** : Dirham, format `1 250,00 DH` (`Intl.NumberFormat('fr-FR')`, espaces normalisés). Helper `money()`.
2. **Numéro client masqué côté livreur** — appel/SMS/WhatsApp relayés par la plateforme, jamais le vrai numéro exposé.
3. **Preuve de livraison paramétrable par commande** : `aucune | photo | signature | photo_signature` (nomenclature canonique `photo_signature`, pas `photo_sig`).
4. **Cascade tarifaire, priorité stricte** : ① prix fixe négocié marchand → ② remise contractuelle → ③ grille standard à paliers de distance. Le 1er niveau applicable l'emporte.
5. **Commission plateforme** : 15 % par défaut (configurable par tenant), **TVA 20 %**.
6. **EU 561/2006 (temps de conduite)** : max 9h/jour, pause obligatoire 45 min après 4h30 cumulées, alerte 30 min avant limite. Bloque `canDrive` au niveau chauffeur.
7. **Loi 09-08 (données personnelles)** : opt-in explicite obligatoire avant tout SMS/WhatsApp. Canaux sans consentement = bloqués.
8. **Retours plafonnés à 3 tentatives** avant reclassement retour hub / souffrance.
9. **Score de fraude ≠ sanction automatique** : toujours revue humaine, le livreur peut se justifier.
10. **Offline-first livreur** : toute action (statut/preuve/COD) fonctionne hors-ligne, horodatée, mise en file, rejouée sans perte ni doublon.
11. **Multi-tenant strict** : isolation totale des données par tenant (voir `transpo-architecture`, schema-per-tenant). Plan expiré/impayé → paywall, sans supprimer les données.

## Flux de l'argent (COD) — boucle complète
`Livreur encaisse (COD)` → `Ma caisse` (plafond) → `Dépôt en agence` (bordereau, remise à 0) → `Réconciliation cash` admin (théorique vs déclaré vs déposé) → `Reversement au marchand` (net = brut − commission). Statuts caisse : `EQUILIBRE | ECART | A_DEPOSER | DEPOSE | EN_COURS`. Un écart se **résout avec motif tracé** (jamais silencieux). Cas inverse : commande annulée/retournée **après** encaissement → **remboursement** (rembourser client / re-créditer marchand / retenir), transaction inverse tracée.

## Retours (reverse logistics)
Motif normalisé (client absent, adresse introuvable, refus, injoignable, endommagé, COD indispo). Statuts : `A_TRAITER | REPLANIFIE | RETOUR_HUB | A_RENDRE | RENDU | SOUFFRANCE`. Reprogrammation possible tant que `tentatives < 3`.

## Fraude COD — score composite (0-100), signaux pondérés
COD non déclaré (35) · écart de caisse récurrent (30) · hors géofence (28) · échec sans preuve GPS (22) · taux « absent » anormal (18) · dépôt tardif >24h (15). Statuts dossier : `OUVERT | ENQUETE | BLANCHI | CONFIRME`.

## Facturation marchand — deux modes coexistants
**Prépayé** (portefeuille débité en temps réel à chaque livraison) OU **post-payé** (facture mensuelle regroupée). Le mode est un attribut du compte marchand, piloté côté admin. En prépayé le portefeuille est actif ; en post-payé il est inactif.

## Entités clés (voir `transpo-api` pour les schémas exacts)
Order, Driver (contrat SALARIE/FREELANCE + taux/course), Vehicle (échéances assurance/CT), Zone (polygone, région/province/commune), Goal (objectif+prime), Tenant, CashSession, Return, FraudCase, Invoice, Notification (canaux + consentement).
