# Run 2026-09-07 — Recette homelab K8s (reprise à zéro)

Environnement : **homelab K8s** — `http://transpo.wedowonders.com` (console),
`http://transpo-api.wedowonders.com` (API), namespace `transpo`.
Base remise à zéro avant le run (seul le super-admin `ops@transpo.ma` subsiste).
Login tenant : `http://transpo.wedowonders.com/login?org=<slug>` (pas de wildcard Ingress).

Verdicts : **OK** / **KO** / **BLOQUÉ** / **N/A** — un cas = une ligne, captures dans `TC-XXX/`.

| Cas | Statut | Constat / anomalie | Captures | Date |
|---|---|---|---|---|
| TC-A01 | OK | Connexion super-admin OK, badge Plateforme affiché, /saas liste vide (0 tenant) | TC-A01/01, 02 | 07/09 |
| TC-A02 | OK | Bascule Plateforme ↔ org détectée (« transpo », artefact du host homelab), email pré-rempli change dans les 2 sens | TC-A02/01–03 | 07/09 |
| TC-A03 | OK | rabatexpress provisionné (Essai 14 j, plan Transporteur), schéma créé, mdp admin temporaire affiché une fois (consigné COMPTES.md) | TC-A03/01–03 | 07/09 |
| TC-A04 | OK | Slugs api/www/admin refusés (400 « Slug réservé à l'infrastructure : <slug> »), rien créé (toujours 1 tenant) | TC-A04/01–04 | 07/09 |
| TC-A05 | OK | Re-provisioning rabatexpress refusé (409 « Tenant déjà existant : rabatexpress »), aucune duplication | TC-A05/01–03 | 07/09 |
| TC-A06 | OK | tangerlog provisionné (Essai 14 j, TPE Coursier), 2 organisations listées, schéma créé, mdp admin consigné COMPTES.md | TC-A06/01–03 | 07/09 |
| TC-A07 | OK | Recherche « tanger » → 1 ligne ; filtre Essai → 2, autres statuts → 0 avec message dédié ; champ vidé restaure les 2 lignes | TC-A07/01–08 | 07/09 |
| TC-A08 | OK | Essai rabatexpress converti : Actif, échéance 2026-10-01, plan Entreprise 2 499 DH, MRR à jour | TC-A08/01–03 | 07/09 |
| TC-A09 | OK | Valider désactivé sur plan en cours ; Transporteur planifié « à l'échéance » sans changer le plan courant ; « Appliquer immédiatement » effectif aussitôt ; retour Entreprise pour la chaîne | TC-A09/01–06 | 07/09 |
| TC-A10 | OK | 1 ligne/org : rabatexpress ACTIF Entreprise 2 499 DH usage 0 ; tangerlog ESSAI 0/500 non facturée (« — ») ; MRR 2 499 DH | TC-A10/01 | 07/09 |
| TC-A11 | OK | 4 plans (Essai/TPE Coursier/Transporteur/Entreprise) avec tarifs et quotas, tous Forfait v1 ; parc cohérent (1 Entreprise, 1 TPE Coursier) | TC-A11/01, 02 | 07/09 |
| TC-A12 | OK | /dashboard et /orders redirigent vers /login avec la session super-admin ; session /saas intacte | TC-A12/01–03 | 07/09 |
| TC-A13 | OK | Plan « Pay as you go » créé (code auto), tarif à l'usage 3 paliers publié, bandeau « sans tarif » disparu, « dès 3 DH/cmd · rétroactif » | TC-A13/01–04 | 07/09 |
| TC-A14 | OK | Trou impossible dans l'UI (recalage auto du palier suivant à 51) ; API directe refusée 400 « Paliers 1 et 2 non contigus : le suivant doit commencer à 51. » | TC-A14/01, 02 | 07/09 |
| TC-A15 | OK | Simulateur 600 cmd : 1 800 DH rétroactif / « (en par tranche : 2 700 DH) », inversés en Par tranche ; rien publié | TC-A15/01, 02 | 07/09 |
| TC-A16 | OK | v2 Entreprise (2 599 DH, effet 09/09) publiée : v1 fermée 07/09→08/09 conserve 1 abonné, v2 courante 0 abonné | TC-A16/01–03 | 07/09 |
| TC-A17 | OK | Date ≤ v1 refusée (« Doit être postérieure au 2026-09-08 (v1). », Publier désactivé) ; date postérieure acceptée | TC-A17/01, 02 | 07/09 |
| TC-A18 | OK | Archivage Entreprise (1 abonné) refusé avec message explicite ; pay-as-you-go archivé → hors catalogue et sélecteur, visible via toggle, restauré | TC-A18/01–06 | 07/09 |
| TC-A19 | OK | Code « essai » doublon refusé (409 « Plan déjà existant : essai »), toujours 5 plans | TC-A19/01, 02 | 07/09 |
| TC-A20 | OK | plan.create/version/archive/restore tracés avec acteur (ops@transpo.ma) et cibles ; subscription.subscribe aussi visibles | TC-A20/01–03 | 07/09 |
| TC-A21 | OK | atlasfret provisionné : Essai 14 j restants (pas Actif), plan visé Transporteur ; mdp admin consigné COMPTES.md | TC-A21/01–03 | 07/09 |
| TC-A22 | OK | 2 cycles consécutifs : compteurs identiques à zéro (0 expiré / 0 suspension / 0 reconduction / 0 réaligné), statuts inchangés | TC-A22/01–03 | 07/09 |
| TC-A23 | OK | Essai atlasfret forcé expiré → cycle : Impayé, bandeau orange « accès reste ouvert », connexion tenant toujours possible | TC-A23/01, 02 | 07/09 |
| TC-A24 | OK | À -6 j rien ne se passe ; à -8 j cycle → Suspendu (sub + tenants.status), bandeau rouge, connexion refusée « Espace suspendu — contactez la plateforme. » | TC-A24/01–04 | 07/09 |
| TC-A25 | OK | renews_at à 2026-07-01 → 1 cycle = 3 reconductions (07→08→09, aucune sautée), renews_at repassé au 2026-10-01 | TC-A25/01 | 07/09 |
| TC-A26 | OK | Réactiver atlasfret suspendu → Actif échéance 2026-10-01, motif effacé, connexion tenant rétablie | TC-A26/01–03 | 07/09 |
| TC-A27 | OK | Résiliation atlasfret : motif obligatoire (bouton désactivé à vide), abonnement clos (RESILIE, plus de courant), connexion refusée, re-souscription possible (non exécutée, requis pour A28) | TC-A27/01–04 | 07/09 |
| TC-A28 | OK | 5 statuts confrontés à la connexion : Essai/Actif/Impayé OK, Suspendu/Résilié refusés (« Espace suspendu… ») — conforme à la matrice | TC-A28/01–06 | 07/09 |
| TC-B01 | OK | Email non amorcé sur rabatexpress → « Identifiants invalides. » ; AN-01 consignée (amorçage CLI, cf. §0.3) | TC-B01/01 | 08/09 |
| TC-B02 | OK | Amorçage CLI `account` admin@rabatexpress.ma → « Compte OK » ; connexion Test1234 → /dashboard, topbar « Nadia Alaoui / Administrateur » ; COMPTES.md mis à jour | TC-B02/01 | 08/09 |
| TC-B03 | OK | /login?org=inexistant → « Tenant inconnu : inexistant » | TC-B03/01 | 08/09 |
| TC-B04 | OK | Email jetable brute-b04@ : 5 × « Identifiants invalides » puis 6ᵉ → 429 « Trop de tentatives. Réessayez plus tard. » | TC-B04/01, 02 | 08/09 |
| TC-B05 | OK | Suspension rabatexpress avec motif → paywall « Espace suspendu — contactez la plateforme. », motif sous le statut ; réactivation → Actif, motif effacé, connexion rétablie (matrice A28 restaurée) | TC-B05/01–05 | 08/09 |
| TC-B06 | OK | Déconnexion via menu avatar → retour /login ; accès direct /orders renvoyé au login (cookies purgés) | TC-B06/01–03 | 08/09 |
| TC-B07 | OK | Invitation dispatcher : dialogue mdp temporaire affiché une fois, compte Reda Ziani Dispatcher Actif listé, mdp plus affiché après fermeture ; bouton Copier inopérant en HTTP → BUG-B1 (mineur, cf. TC-B11) | TC-B07/01, 02 | 08/09 |
| TC-B08 | OK | Invitation comptable : mdp temporaire affiché une fois (consigné COMPTES.md), Salma Bennis Comptable Actif listée, compteurs 3 util. / 3 actifs / 1 admin | TC-B08/01, 02 | 08/09 |
| TC-B09 | OK | Email invalide : Inviter désactivé + API 400 « Email invalide. » ; doublon dispatch@ → alerte « Cet email est déjà utilisé. », rien créé (3 util.) | TC-B09/01, 02 | 08/09 |
| TC-B10 | OK | Dispatcher puis comptable connectés avec leurs mdp temporaires → /dashboard, topbar « Reda Ziani / Dispatcher » et « Salma Bennis / Comptable » | TC-B10/01, 02 | 08/09 |
| TC-B11 | OK | Reset mdp dispatcher : nouveau mdp temporaire affiché, ancien refusé (« Identifiants invalides. »), nouveau accepté → /dashboard. BUG-B1 (mineur) bouton Copier inopérant en HTTP → **corrigé au retest 08/09** (repli execCommand, valeur copiée vérifiée, feedback ✓, aucune erreur console) | TC-B11/01, 01b–03 + retest-01/02 | 08/09 |
| TC-B12 | OK | Comptable → Dispatcher : badge et base à jour ; reconnexion → topbar Dispatcher + « Nouvelle commande » accessible ; retour Comptable rétabli | TC-B12/01–03 | 08/09 |
| TC-B13 | OK | Désactivation dispatcher (confirmation + badge Désactivé, compteurs à jour) → connexion refusée ; réactivation → badge Actif, connexion rétablie | TC-B13/01–05 | 08/09 |
| TC-B14 | OK | Désactivation et rétrogradation du dernier admin toutes deux refusées (« Impossible : dernier administrateur du tenant. ») ; admin toujours Administrateur Actif | TC-B14/01, 02 | 08/09 |
| TC-B15 | OK | API : enforcement 403 intégral, lectures conformes. 3 écarts du 08/09 **corrigés au retest 08/09** : BUG-B2 /pricing en lecture seule UI (dispatcher+comptable, simulateur et export CSV fonctionnels) ; BUG-B3 POST /orders {} → 400 « Champs requis manquants : fromCity, toCity. » ; BUG-B4 journal notifications accessible en lecture au comptable (UI + GET 200, écritures 403) | TC-B15/01–12 + retest-* | 08/09 |
| TC-C01 | OK | Identité légale enregistrée (bouton « Enregistré ✓ ») et persistée après rechargement + base (Rabat Express SARL / ICE / RC / adresse) | TC-C01/01–03 | 09/09 |
| TC-C02 | OK | Commission 15→18 % puis TVA 20 % : « Enregistré ✓ », persistance UI + base (0.18→0.15 restauré) ; valeurs finales 15 %/20 % pour TC-M/N | TC-C02/01–03 | 09/09 |
| TC-C03 | OK | Régional : langue par défaut FR→AR persistée (UI + base `MAD \| Africa/Casablanca \| ar`) puis FR restauré ; devise/fuseau mono-option (MAD, Africa/Casablanca) | TC-C03/01–04 | 09/09 |
| TC-C04 | OK | Dispatcher : /settings en lecture seule (bandeau dédié, champs désactivés, aucun bouton), POST /v1/settings/company → 403 « Rôle insuffisant », valeurs inchangées | TC-C04/01, 02 | 09/09 |
| TC-D01 | OK | Véhicule 1111-A-11 (Fourgon, Rabat, assurance/CT 2029) créé, badge Actif, 0 alerte d'échéance | TC-D01/01–03 | 09/09 |
| TC-D02 | OK | 2222-B-22 créé avec assurance « Expirée (251 j) » rouge + bandeau flotte ; alerte « assurance expirée » remontée au bloc Conformité du /dashboard | TC-D02/01–03 | 09/09 |
| TC-D03 | OK | Cycle d'états véhicule 1 : Actif → Maintenance → Hors service → Actif, badges et compteurs reflétés à chaque fois, persisté | TC-D03/01–03 | 09/09 |
| TC-D04 | OK | Assurance 2222-B-22 renouvelée au 06/2029 : alerte disparue de /vehicles (0 alerte) et du /dashboard (« Aucune échéance en alerte. ») | TC-D04/01–03 | 09/09 |
| TC-D06 | OK | Hamid Ouali et Sara Bennis créés ; Sara : visite « Expiré (251 j) » + badge Bloqué, KPI Conformité 1, bandeau « exclus des suggestions de dispatch » | TC-D06/01–03 | 09/09 |
| TC-D07 | OK | Téléphone « abc » : UI bloquée (« Numéro invalide. », Ajouter désactivé) ; API POST /v1/drivers → 400 « Téléphone invalide. » ; rien créé | TC-D07/01, 02 | 09/09 |

*(rempli par l'agent testeur au fil du run)*
