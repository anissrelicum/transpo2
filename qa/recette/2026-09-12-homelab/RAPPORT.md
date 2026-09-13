# Run 2026-09-12 — Recette homelab K8s (reprise à zéro, preuves vidéo)

Environnement : **homelab K8s** — `http://transpo.wedowonders.com` (console),
`http://transpo-api.wedowonders.com` (API), namespace `transpo`, cluster Talos 3 nœuds.
Base remise à zéro avant le run (seul le super-admin `ops@transpo.ma` subsiste).
Login tenant : `http://transpo.wedowonders.com/login?org=<slug>` (pas de wildcard Ingress).

**Preuves : une vidéo `.webm` par cas** dans `TC-XXX/` (le run du 07/09 utilisait des PNG).
Chaque étape est annoncée par un bandeau incrusté en bas de l'image.
**iOS hors périmètre** (pas de Xcode sur le poste) — la section G est jouée sur
**émulateur Android** `Medium_Phone_API_36.1` (Android 16, x86_64).

Verdicts : **OK** / **KO** / **BLOQUÉ** / **N/A** — un cas = une ligne.

| Cas | Statut | Constat / anomalie | Preuve | Date |
|---|---|---|---|---|
| TC-A01 | OK | Badge Plateforme, connexion super-admin, /saas vide (0 tenant) | [TC-A01.webm](TC-A01/TC-A01.webm) | 12/09 |
| TC-A02 | OK | Bascule Plateforme ↔ organisation détectée dans les deux sens, email pré-rempli à jour | [TC-A02.webm](TC-A02/TC-A02.webm) | 12/09 |
| TC-A03 | OK | rabatexpress provisionné (Essai 14 j, Transporteur), schéma créé, mdp admin affiché une fois | [TC-A03.webm](TC-A03/TC-A03.webm) | 12/09 |
| TC-A04 | OK | api/www/admin refusés 400 « Slug réservé à l'infrastructure », rien créé | [TC-A04.webm](TC-A04/TC-A04.webm) | 12/09 |
| TC-A05 | OK | Doublon refusé 409 « Tenant déjà existant », aucune duplication | [TC-A05.webm](TC-A05/TC-A05.webm) | 12/09 |
| TC-A06 | OK | tangerlog provisionné (Essai, TPE Coursier), 2 organisations listées | [TC-A06.webm](TC-A06/TC-A06.webm) | 12/09 |
| TC-A07 | OK | Recherche et filtres effectifs, champ vidé restaure les 2 lignes | [TC-A07.webm](TC-A07/TC-A07.webm) | 12/09 |
| TC-A08 | OK | Conversion → Actif, échéance 2026-10-01, Entreprise 2 499 DH. **→ AN-12** | [TC-A08.webm](TC-A08/TC-A08.webm) | 12/09 |
| TC-A09 | OK | Plan courant inchangé + « à l'échéance » ; Appliquer immédiatement effectif ; Valider désactivé sur plan courant | [TC-A09.webm](TC-A09/TC-A09.webm) | 12/09 |
| TC-A10 | OK | 1 ligne/org, montants cohérents, usage 0, MRR à jour | [TC-A10.webm](TC-A10/TC-A10.webm) | 12/09 |
| TC-A11 | OK | 4 plans avec tarifs et quotas, répartition du parc conforme | [TC-A11.webm](TC-A11/TC-A11.webm) | 12/09 |
| TC-A12 | OK | /dashboard et /orders redirigés vers /login, session /saas intacte | [TC-A12.webm](TC-A12/TC-A12.webm) | 12/09 |
| TC-A13 | OK | Plan « pay-as-you-go » créé, tarif à l'usage 3 paliers publié | [TC-A13.webm](TC-A13/TC-A13.webm) | 12/09 |
| TC-A14 | OK | Trou impossible dans l'UI (recalage auto) ; API directe refusée 400 | [TC-A14.webm](TC-A14/TC-A14.webm) | 12/09 |
| TC-A15 | OK | Simulateur conforme en VOLUME et GRADUÉ, rien publié | [TC-A15.webm](TC-A15/TC-A15.webm) | 12/09 |
| TC-A16 | OK | v2 à J+1 publiée : v1 garde 1 abonné, v2 courante 0 abonné | [TC-A16.webm](TC-A16/TC-A16.webm) | 12/09 |
| TC-A17 | OK | « Doit être postérieure au 2026-09-12 », Publier désactivé ; J+1 accepté | [TC-A17.webm](TC-A17/TC-A17.webm) | 12/09 |
| TC-A18 | OK | Archivage d'un plan avec abonnés refusé ; plan sans abonné archivé puis restauré | [TC-A18.webm](TC-A18/TC-A18.webm) | 12/09 |
| TC-A19 | OK | Code de plan en doublon refusé 409, catalogue inchangé | [TC-A19.webm](TC-A19/TC-A19.webm) | 12/09 |
| TC-A20 | OK | plan.create/version/archive/restore et subscription.subscribe tracés avec acteur et cible | [TC-A20.webm](TC-A20/TC-A20.webm) | 12/09 |
| TC-A21 | OK | atlasfret naît en Essai daté (14 j), pas Actif | [TC-A21.webm](TC-A21/TC-A21.webm) | 12/09 |
| TC-A22 | OK | 2 cycles consécutifs neutres, compteurs à zéro, statuts inchangés | [TC-A22.webm](TC-A22/TC-A22.webm) | 12/09 |
| TC-A23 | OK | Essai échu → Impayé, bandeau orange, accès tenant resté ouvert | [TC-A23.webm](TC-A23/TC-A23.webm) | 12/09 |
| TC-A24 | OK | À -6 j rien ; à -8 j suspension effective et connexion refusée | [TC-A24.webm](TC-A24/TC-A24.webm) | 12/09 |
| TC-A25 | OK | 1 cycle rattrape 3 reconductions manquées, aucune sautée | [TC-A25.webm](TC-A25/TC-A25.webm) | 12/09 |
| TC-A26 | OK | Réactivation → Actif, motif effacé (ACTIF|-), connexion rétablie | [TC-A26.webm](TC-A26/TC-A26.webm) | 12/09 |
| TC-A27 | OK | Motif obligatoire, abonnement RESILIE, accès coupé | [TC-A27.webm](TC-A27/TC-A27.webm) | 12/09 |
| TC-A28 | OK | 5 statuts confrontés à la connexion, conforme à la matrice | [TC-A28.webm](TC-A28/TC-A28.webm) | 12/09 |
| TC-A29 | OK | *(cas ajouté)* Admin d'une organisation existante créé puis réinitialisé depuis la console, tracé à l'audit. **AN-11 clôturée** | [TC-A29.webm](TC-A29/TC-A29.webm) | 12/09 |
| TC-B01 | OK | « Identifiants invalides » sur email non amorcé ; le provisioning crée désormais l'admin (AN-01 corrigé) | [TC-B01/](TC-B01/) | 12/09 |
| TC-B02 | OK | Amorçage CLI `account` → « Compte OK », connexion Test1234 → /dashboard, topbar « Nadia Alaoui / Administrateur » | [TC-B02/](TC-B02/) | 12/09 |
| TC-B03 | OK | Organisation inconnue et mot de passe faux renvoient le **même message et le même code** (401). **OBS-01 corrigée** | [TC-B03.webm](TC-B03/TC-B03.webm) | 12/09 |
| TC-B04 | OK | 5 refus puis 429 « Trop de tentatives ». Compteur désormais en base et compté aussi par IP — voir TC-B16 | [TC-B04.webm](TC-B04/TC-B04.webm) | 12/09 |
| TC-B05 | OK | Suspension avec motif → paywall + motif affiché ; réactivation → Actif, motif effacé, connexion rétablie | [TC-B05/](TC-B05/) | 12/09 |
| TC-B06 | OK | Déconnexion → /login ; accès direct /orders renvoyé au login (cookies purgés) | [TC-B06/](TC-B06/) | 12/09 |
| TC-B07 | OK | Mot de passe temporaire affiché une fois, copie confirmée par retour visuel, compte listé Dispatcher Actif | [TC-B07/](TC-B07/) | 12/09 |
| TC-B08 | OK | Comptable invitée, listée, compteurs à jour | [TC-B08/](TC-B08/) | 12/09 |
| TC-B09 | OK | « Email invalide. » puis « Cet email est déjà utilisé. », rien créé | [TC-B09/](TC-B09/) | 12/09 |
| TC-B10 | OK | Dispatcher et comptable connectés avec leurs mdp temporaires, nom et rôle affichés | [TC-B10/](TC-B10/) | 12/09 |
| TC-B11 | OK | Nouveau mdp temporaire ; ancien refusé, nouveau accepté | [TC-B11/](TC-B11/) | 12/09 |
| TC-B12 | OK | Comptable → Dispatcher → Comptable, accès conforme après reconnexion. **AN-13 corrigée** : plus de gel | [TC-B12.webm](TC-B12/TC-B12.webm) | 12/09 |
| TC-B13 | OK | Désactivation → connexion refusée ; réactivation → connexion rétablie. **AN-13 corrigée** | [TC-B13.webm](TC-B13/TC-B13.webm) | 12/09 |
| TC-B14 | OK | Désactivation et rétrogradation du dernier admin refusées explicitement | [TC-B14/](TC-B14/) | 12/09 |
| TC-B15 | OK | Matrice RBAC ADMIN/DISPATCHER/COMPTABLE : enforcement 403 intégral côté API, UI conforme | [TC-B15/](TC-B15/) | 12/09 |
| TC-B16 | OK | *(cas ajouté)* Blocage survit au redémarrage de l'API ; balayage d'adresses freiné par le compteur d'IP. **OBS-02 clôturée** | [TC-B16.webm](TC-B16/TC-B16.webm) | 12/09 |
| TC-C01 | OK | Identité légale enregistrée (« Enregistré ✓ »), persistée après rechargement + base | [TC-C01.webm](TC-C01/TC-C01.webm) | 12/09 |
| TC-C02 | OK | Commission 15→18 % puis restaurée à 15 % ; base `0.18` → `0.15`, TVA 20 % — valeurs de référence pour M/N | [TC-C02.webm](TC-C02/TC-C02.webm) | 12/09 |
| TC-C03 | OK | Langue par défaut FR→AR→FR persistée (base `MAD \| Africa/Casablanca \| ar`) ; devise et fuseau mono-option, persistance non démontrable | [TC-C03.webm](TC-C03/TC-C03.webm) | 12/09 |
| TC-C04 | OK | Dispatcher : lecture seule, champs désactivés, aucun bouton ; POST /v1/settings/company → 403 | [TC-C04.webm](TC-C04/TC-C04.webm) | 12/09 |
| TC-D01 | OK | 1111-A-11 (Fourgon, Rabat, 2029) créé, Actif, 0 alerte d'échéance | [TC-D01.webm](TC-D01/TC-D01.webm) | 12/09 |
| TC-D02 | OK | 2222-B-22 à assurance expirée : alerte sur la fiche, bandeau flotte et bloc Conformité du /dashboard | [TC-D02.webm](TC-D02/TC-D02.webm) | 12/09 |
| TC-D03 | OK | Actif → Maintenance → Hors service → Actif, reflété à chaque fois et persisté | [TC-D03.webm](TC-D03/TC-D03.webm) | 12/09 |
| TC-D04 | OK | Assurance renouvelée : 0 alerte sur /vehicles, « Aucune échéance en alerte. » au /dashboard | [TC-D04.webm](TC-D04/TC-D04.webm) | 12/09 |
| TC-D05 | OK | Véhicule jetable retiré ; retrait d'un véhicule **rattaché refusé en 400** avec le nom du chauffeur, parc et fiche intacts. **AN-15 corrigée** | [TC-D05.webm](TC-D05/TC-D05.webm) | 12/09 |
| TC-D06 | OK | Hamid Ouali et Sara Bennis créés ; Sara « Expiré » + Bloqué + exclue du dispatch | [TC-D06.webm](TC-D06/TC-D06.webm) | 12/09 |
| TC-D07 | OK | Téléphone `abc` : UI bloquée (« Numéro invalide. ») et API 400 « Téléphone invalide. » | [TC-D07.webm](TC-D07/TC-D07.webm) | 12/09 |
| TC-D08 | OK | Plaque rattachée (PATCH 200, type synchronisé Fourgon), console restée vivante. **AN-13 corrigée** | [TC-D08.webm](TC-D08/TC-D08.webm) | 12/09 |
| TC-D09 | OK | Sara redevient affectable (plus d'« Expiré », plus de Bloqué, 0 non affectable), sans gel | [TC-D09.webm](TC-D09/TC-D09.webm) | 12/09 |
| TC-D10 | OK | Bascule persistée côté admin **et** côté dispatcher (action bien ouverte au dispatch) ; Sara laissée indisponible pour TC-F03 | [TC-D10.webm](TC-D10/TC-D10.webm) | 12/09 |
| TC-D11 | OK | Retrait direct sans course ; **avec courses en cours, transfert à un repreneur exigé** (2 transférées, la livrée reste au partant) ; refus 400 sans repreneur | [TC-D11.webm](TC-D11/TC-D11.webm) | 13/09 |
| TC-D12 | OK | *(cas ajouté)* Plaque en doublon refusée 409, parc inchangé. **AN-16 corrigée** | [TC-D12.webm](TC-D12/TC-D12.webm) | 12/09 |
| TC-D13 | OK | *(cas ajouté)* Plaque `ABCD` : UI bloquée et API 400 « format marocain NNNN-L-NN » | [TC-D13.webm](TC-D13/TC-D13.webm) | 12/09 |
| TC-D14 | OK | *(cas ajouté)* Chauffeur homonyme refusé 409 — les commandes référencent le chauffeur par son nom | [TC-D14.webm](TC-D14/TC-D14.webm) | 12/09 |
| TC-D15 | OK | *(cas ajouté)* Véhicule en maintenance absent des options et rattachement forcé refusé 400 | [TC-D15.webm](TC-D15/TC-D15.webm) | 12/09 |
| TC-D16 | OK | *(cas ajouté)* Véhicule déjà rattaché annoncé dans le sélecteur et par un avertissement avant validation | [TC-D16.webm](TC-D16/TC-D16.webm) | 12/09 |
| TC-D17 | OK | *(cas ajouté)* Retrait d'un véhicule rattaché refusé 400, **chauffeur nommé dans le message** | [TC-D17.webm](TC-D17/TC-D17.webm) | 12/09 |
| TC-D18 | OK | *(cas ajouté)* Échéance passée refusée côté UI (champ borné, bouton désactivé) et côté API (400). **OBS-10 corrigée** | [TC-D18.webm](TC-D18/TC-D18.webm) | 12/09 |
| TC-D19 | OK | *(cas ajouté)* Fiche chauffeur modifiable ; le type déclaré survit au détachement. **AN-14 corrigée** | [TC-D19.webm](TC-D19/TC-D19.webm) | 12/09 |
| TC-D20 | OK | *(cas ajouté)* Dispatcher : flotte en lecture seule, 7 écritures API refusées 403, disponibilité exceptée | [TC-D20.webm](TC-D20/TC-D20.webm) | 12/09 |
| TC-D21 | OK | *(cas ajouté)* 5 actions enchaînées sans rechargement : page cliquable à chaque fois. **Non-régression AN-13** | [TC-D21.webm](TC-D21/TC-D21.webm) | 12/09 |
| TC-E01 | OK | Zone `Rabat Centre` créée, 4 sommets exacts en base, tracée sur la carte. **AN-17 corrigée** | [TC-E01.webm](TC-E01/TC-E01.webm) | 12/09 |
| TC-E02 | OK | « Effacer » ne touche que le tracé en cours : zone intacte, base inchangée, tracé retrouvé au rechargement | [TC-E02.webm](TC-E02/TC-E02.webm) | 12/09 |
| TC-E03 | OK | Affectation immédiate et persistée ; « Tous les livreurs sont affectés. » enfin atteignable. **AN-18 corrigée** | [TC-E03.webm](TC-E03/TC-E03.webm) | 12/09 |
| TC-E04 | OK | Livreur retiré, zone jetable supprimée ; confirmation passée du `confirm()` natif à un dialogue applicatif | [TC-E04.webm](TC-E04/TC-E04.webm) | 12/09 |
| TC-E05 | OK | La zone est tracée sur les cartes `/dispatch` et `/fleet` | [TC-E05.webm](TC-E05/TC-E05.webm) | 12/09 |
| TC-E06 | OK | *(cas ajouté)* Nom vide → 400 ; livreur fantôme → 400 « Livreur inconnu ». **AN-19 corrigée** | [TC-E06.webm](TC-E06/TC-E06.webm) | 12/09 |
| TC-E07 | OK | *(cas ajouté)* Polygone à 2 sommets → 400, tracé enregistré intact. **AN-20 corrigée** | [TC-E07.webm](TC-E07/TC-E07.webm) | 12/09 |
| TC-E08 | OK | *(cas ajouté)* Dispatcher écrit (200), comptable en lecture seule (3 écritures → 403) | [TC-E08.webm](TC-E08/TC-E08.webm) | 12/09 |
| TC-F01 | OK | Commande créée (réf, code 8 car., Nouvelle) **et coordonnées des deux points conservées**. **AN-22 corrigée** | [TC-F01.webm](TC-F01/TC-F01.webm) | 13/09 |
| TC-F02 | OK | Six commandes créées à l'assistant : 3 COD / 3 prépayées, 4 niveaux de preuve, 5 villes | [TC-F02.webm](TC-F02/TC-F02.webm) | 13/09 |
| TC-F03 | OK | Scores /100 détaillés (Zone 40 + Dispo 30 + Charge 30), badge Recommandé, indisponible exclue, commande assignée | [TC-F03.webm](TC-F03/TC-F03.webm) | 13/09 |
| TC-F04 | OK | Assignation depuis le menu de ligne ; chauffeur affecté marqué d'un ✓ | [TC-F04.webm](TC-F04/TC-F04.webm) | 13/09 |
| TC-F05 | OK | Assignée → Retrait → Récupérée → Livraison, puis progression désactivée | [TC-F05.webm](TC-F05/TC-F05.webm) | 13/09 |
| TC-F06 | OK | Pas nominal permis (200) ; **clôture sans preuve refusée 400**. **AN-21 corrigée** | [TC-F06.webm](TC-F06/TC-F06.webm) | 13/09 |
| TC-F07 | OK | 3 assignées puis 2 avancées, sélection vidée ; l'action de masse **demande désormais à qui affecter** | [TC-F07.webm](TC-F07/TC-F07.webm) | 13/09 |
| TC-F08 | OK | Filtres effectifs et combinables, état vide annoncé, Réinitialiser restaure, recherche par référence | [TC-F08.webm](TC-F08/TC-F08.webm) | 13/09 |
| TC-F09 | OK | Barre supérieure → `/orders?q=<réf>`, liste filtrée à une ligne | [TC-F09.webm](TC-F09/TC-F09.webm) | 13/09 |
| TC-F10 | OK | 20 commandes / 3 pages : bornes désactivées aux extrémités, page courante mise en évidence | [TC-F10.webm](TC-F10/TC-F10.webm) | 13/09 |
| TC-F11 | OK | Onglets conformes ; **historique horodaté et attribué** ; copie du code réellement effectuée. **AN-24, AN-25 corrigées** | [TC-F11.webm](TC-F11/TC-F11.webm) | 13/09 |
| TC-F12 | OK | Annulée ; actions de cycle de vie désactivées, seconde annulation refusée 400 | [TC-F12.webm](TC-F12/TC-F12.webm) | 13/09 |
| TC-F13 | OK | Compte marchand créé depuis /users, commande déposée au portail, exploitation refusée 403, usurpation de marchand neutralisée. **AN-23, AN-26, AN-27 corrigées** | [TC-F13.webm](TC-F13/TC-F13.webm) | 13/09 |

## Constats produit — section A

**AN-12 — Après la fermeture d'un dialogue, toute la console sort de l'arbre d'accessibilité.**
Le conteneur racine `<div class="radix-themes">`, qui enveloppe l'application entière, conserve
`aria-hidden="true"` après la fermeture d'un dialogue (reproduit sur « Convertir l'essai »,
`apps/console-web/components/SaasTenantsView.tsx:358`). L'affichage reste correct pour un œil
humain — la donnée se rafraîchit bien — mais **la page entière disparaît pour un lecteur d'écran**
jusqu'au rechargement : plus aucune ligne, plus aucun bouton n'est annonçable.
Cause probable : `router.refresh()` re-rend l'arbre pendant que Radix démonte le dialogue, si bien
que le nettoyage de l'attribut vise un nœud détaché.
Sévérité **moyenne-haute** en accessibilité, nulle en usage visuel — ce qui explique qu'il soit
passé inaperçu. Le dialogue étant un composant partagé, tous les écrans à dialogue sont suspects
(à confronter en sections B → T).
*Piste :* fermer le dialogue **puis** déclencher `router.refresh()` (deux tours de boucle), ou
laisser Radix terminer son démontage avant de re-rendre.

**OBS-05 — Les specs de recette du run 07/09 n'étaient pas rejouables.**
Elles codaient en dur des dates (`2026-09-09`, `2026-09-08`, fenêtres de version) et des mots de
passe temporaires (`f9f1bJZ8Eebl`) propres au jour de leur écriture. Rejouées le 12/09, huit cas
échouaient pour des raisons d'outillage et non de produit. Plus grave : **TC-A27 passait pour la
mauvaise raison** — il attend un refus de connexion, et le refus venait du mot de passe périmé,
pas de la résiliation testée. Une suite de non-régression qui verdit sans rien vérifier est pire
que pas de suite du tout. Sévérité **moyenne** (outillage).
*Corrigé :* helpers `isoPlus()` (dates relatives au jour du run) et `motDePasse()` (relecture de
`COMPTES.md`) ; plus aucune date ni aucun secret en dur dans les specs de la section A.

**OBS-06 — La remise à zéro laissait le catalogue de plans intact.**
`reset-test.ts` purgeait les tenants mais pas `platform.plans` : le homelab portait 11 plans, dont
7 déchets de runs précédents (`pay-as-you-go`, `usage-reg-*`), alors que TC-A11 en attend 4. Toute
reprise « depuis zéro » démarrait donc d'une base non conforme au plan §A-bis, sans que ça se voie.
Sévérité **moyenne** (outillage). *Corrigé* dans `packages/db/src/reset-test.ts:28`.

**OBS-07 — Le cycle d'abonnement écrit avant que la console ne montre le résultat.**
Après « Lancer le cycle », un rechargement immédiat rend encore l'état d'avant ; il faut recharger
une seconde fois. Sans conséquence fonctionnelle (la donnée est juste), mais trompeur pour
l'exploitant qui lance le cycle et croit qu'il n'a rien fait. Sévérité **faible**.
*Contourné côté recette* par le helper `attendreLigne()`.

## Constats produit — section B

**AN-13 — L'interface se fige après un changement de rôle ou une désactivation d'utilisateur.**
*(Même cause qu'AN-12, mais la conséquence est bien plus grave que ce que la section A laissait voir.)*

> ⚠ **La cause avancée ci-dessous est erronée.** La mesure faite en section D a montré que le
> verrou venait du **menu « … » resté ouvert**, pas d'une course avec `router.refresh()`. Le
> constat d'observation reste exact — c'est l'explication qui était fausse. Diagnostic corrigé et
> correctif : voir « Constats produit — sections C et D, et suites données » plus bas. Le passage
> est conservé tel quel : une hypothèse plausible et fausse, confirmée par un correctif qui n'a
> rien changé, fait partie de ce que la recette doit garder en mémoire.

Mesure directe sur `/users` après avoir enregistré un changement de rôle :
```
AVANT → pointerEvents=auto  scrollLocked=false  ariaHiddenRacine=false  lignesParRôle=4
APRÈS → pointerEvents=none  scrollLocked=true   ariaHiddenRacine=true   lignesParRôle=0
MENU AVATAR CLIQUABLE = NON — interface figée
```
`document.body` conserve `pointer-events: none` et le verrou de défilement : **plus rien n'est
cliquable sur toute la page** — ni un autre utilisateur, ni le menu, ni la déconnexion. Seul un
rechargement (F5) rend la main. L'administrateur qui change un rôle se retrouve devant une console
morte, sans message ni indice.

*Cause.* `apps/console-web/components/UsersView.tsx:158` —
`onClick={() => { onChange(role); setOpen(false); }}` : la mutation asynchrone n'est **pas attendue**
et `setOpen(false)` s'exécute aussitôt. Radix démonte le dialogue pendant que `router.refresh()`
(`UsersView.tsx:44`) re-rend l'arbre ; le nettoyage de Radix (restauration de `pointer-events`, du
verrou de défilement et d'`aria-hidden`) vise alors des nœuds détachés et n'atteint jamais le nouvel
arbre. Même motif dans `apps/console-web/components/SaasTenantsView.tsx:358`
(`if (await onSave(...)) setOpen(false)`).

*Ce qui ne déclenche PAS le gel* (vérifié) : fermeture par **Échap**, fermeture par le bouton
**Fermer** d'un `Dialog.Close`. Le gel est propre aux dialogues dont la fermeture court contre
`router.refresh()`.

Sévérité **haute** : action d'administration courante, blocage total, aucun retour à l'utilisateur.
*Piste :* attendre la mutation, fermer le dialogue, **puis** déclencher le rafraîchissement au tour
de boucle suivant (`setOpen(false); requestAnimationFrame(() => router.refresh())`).

**OBS-08 — Le découpage en specs « suite » du run 07/09 masquait AN-13.**
TC-B12 et TC-B13 avaient été scindés en `b12-suite` / `b13-suite`, chacune repartant d'un navigateur
neuf. Le motif du découpage était précisément le gel : le cas ne pouvait pas aller au bout d'une
traite. Interprété comme de l'instabilité de test, il a été contourné au lieu d'être remonté — et
les deux cas ont été consignés « OK » le 08/09. Les trois specs redondantes (`b12b`, `b12c`, `b13b`)
sont supprimées : `b12` et `b13` couvrent désormais l'intégralité des cas du plan, gel compris
(détecté et tracé par le helper `leverGelAN12()`).

**OBS-09 — Le presse-papiers n'est pas vérifiable sur le homelab.**
Le cluster est servi en **HTTP**, donc hors contexte sécurisé : `navigator.clipboard` est
indisponible. Le produit gère correctement le repli (`apps/console-web/lib/clipboard.ts`, testé via
le retour visuel vert), mais **aucune recette ne peut vérifier le contenu réellement copié** tant que
le homelab n'est pas en HTTPS. Sévérité **faible** (environnement de recette).

## Constats produit — sections C et D, et suites données

Tous les défauts relevés dans ce run ont été **corrigés, redéployés et reconfrontés** le même
jour. Chaque anomalie ci-dessous porte le cas qui la tient désormais en non-régression.

**AN-13 — La console entière devenait morte après une action lancée depuis un menu « … ». _Corrigée._**

*Correction du diagnostic.* Le premier constat (section B) attribuait le gel à une course entre
`router.refresh()` et le démontage du dialogue. **C'était faux.** La sonde posée en section D a
mesuré l'état du document à chaque étape :
```
menu ouvert        → pointerEvents=none  scrollLocked=true  ariaHidden=true   menus=1  dialogs=0
dialogue ouvert    → pointerEvents=none  scrollLocked=true  ariaHidden=true   menus=1  dialogs=1
APRÈS enregistrement → pointerEvents=none  scrollLocked=true  ariaHidden=true  menus=1  dialogs=0
après Échap        → pointerEvents=auto   scrollLocked=false ariaHidden=false  menus=0  dialogs=0
```
Le verrou ne venait pas du dialogue mais du **menu**, resté ouvert derrière lui. Les actions à
dialogue déclarent `onSelect` + `preventDefault()` pour que le menu ne se ferme pas sous le clic —
et plus rien ne le refermait ensuite. Un menu Radix **modal** posant `pointer-events: none`, le
verrou de défilement et `aria-hidden` sur toute la page, la console restait morte jusqu'au
rechargement. Échap la ranimait, ce qui explique que le défaut ait été pris pour de l'instabilité
de test (OBS-08) plutôt que remonté.

*Correctif.* Un composant partagé `RowMenu` (`apps/console-web/lib/row-menu.tsx`) : menu **non
modal**, et refermé dès que le dialogue qu'il a ouvert se referme (`useFermerMenu()`). Une
fermeture **programmatique** d'un dialogue ne déclenche pas `onOpenChange` — Radix ne l'appelle que
lorsqu'il demande lui-même le changement — d'où une poignée explicite. Appliqué aux six écrans à
menu de ligne : chauffeurs, véhicules, utilisateurs, organisations, plans, modèles.
*Au passage :* les boutons attendent désormais la mutation avant de fermer (un refus de l'API
fermait quand même le dialogue), et `useSafeRefresh()` diffère le rafraîchissement d'un tour de
boucle d'affichage.
**Tenu par TC-D21** (5 actions enchaînées sans rechargement), **TC-A29** (console plateforme),
TC-B12, TC-B13, TC-D08, TC-D09.

**AN-14 — Détacher un véhicule effaçait le type déclaré du chauffeur. _Corrigée._**
`assignVehicle` synchronisait `vehicle` sur le type du véhicule, donc le mettait à `null` au
détachement — et **aucun écran ni endpoint ne permettait de modifier une fiche chauffeur** : la
capacité saisie à la création était perdue pour de bon, alors que le scoring de dispatch s'appuie
dessus. Le détachement conserve maintenant le libellé, et une action **« Modifier la fiche »**
(ville, type déclaré, téléphone, n° de permis) ouvre ce qui était jusqu'ici figé. Le **nom** reste
protégé : renommer est refusé tant que des commandes référencent le chauffeur, avec leur nombre.
**Tenu par TC-D19.**

**AN-15 — Retirer un véhicule rattaché à un chauffeur était accepté sans garde-fou. _Corrigée._**
`DELETE /v1/vehicles/<id>` répondait **200** sur un véhicule rattaché, sans mentionner le chauffeur,
et `drivers.vehicle_id` n'ayant aucune clé étrangère, la fiche gardait l'identifiant d'un véhicule
disparu. Le retrait est désormais refusé en **400**, en nommant le ou les chauffeurs concernés —
symétrique du garde-fou qui protégeait déjà le retrait d'un chauffeur.
**Tenu par TC-D17** et par le second volet de **TC-D05**.

**AN-16 — Deux véhicules pouvaient porter la même immatriculation. _Corrigée._**
Trouvée en écrivant TC-D12 : `createVehicle` n'avait aucun contrôle d'unicité, alors que la plaque
identifie le véhicule sur le terrain (affectation, preuve, tracking) et que le contrôle existait
côté chauffeur. Refus **409** désormais, comparaison insensible à la casse et aux espaces. Les
doublons de la plateforme (tenants, codes de plan, plaques, noms de chauffeur) répondent tous 409.
**Tenu par TC-D12.**

**OBS-10 — « Renouveler » acceptait une date passée. _Corrigée._**
L'action censée régulariser pouvait **déclasser** une fiche conforme, sans borne côté UI ni
validation côté API. Champ borné au jour même, message explicite, bouton désactivé, et refus **400**
côté API — sur les chauffeurs comme sur les véhicules. **Tenu par TC-D18.**

## Constats produit — sections A et B, suites données

**AN-11 — Une organisation sans administrateur actif était irrécupérable. _Corrigée._**
Le provisioning crée l'admin (AN-01), mais une organisation antérieure à ce correctif — ou dont le
dernier administrateur a été désactivé — n'avait **ni écran ni endpoint** pour reprendre la main,
même en super-admin : il fallait un accès shell à la production. Une action **« Créer / réinitialiser
l'administrateur »** est ajoutée au menu d'une organisation ; mot de passe temporaire affiché une
seule fois, compte existant réactivé et repassé ADMIN plutôt que dupliqué, action tracée au journal
(`tenant.admin.create` / `tenant.admin.reset`). **Tenue par TC-A29.**

**OBS-01 — La réponse de login permettait d'énumérer les organisations. _Corrigée._**
Un slug inconnu répondait 400 « Tenant inconnu : `<slug>` », un slug réel 401 « Identifiants
invalides » : comparer deux réponses suffisait à dresser la liste des clients. Les deux cas
renvoient maintenant **le même message et le même code** ; le détail part au journal serveur.
**Tenue par TC-B03**, qui compare explicitement les deux réponses et les deux codes HTTP.

**OBS-02 — L'anti-bruteforce ne tenait pas la charge réelle. _Corrigée._**
Compteur en mémoire du processus : remis à zéro à chaque déploiement, indépendant d'une réplique à
l'autre, et keyé `(tenant,email)` seulement — le *password spraying* n'était jamais freiné. Il vit
désormais en base (`platform.login_attempts`, migration `0004`), avec **deux clés** : par compte
(seuil 5) et par source (seuil 30, plus haut car une sortie NAT peut être partagée). Le realm
super-admin, qui n'était soumis à **aucun** comptage, suit les mêmes règles.
**Tenue par TC-B16**, qui redémarre l'API en plein test et vérifie que le blocage survit.

*Conséquence pour la recette :* le budget par source est global à la machine de test sur 15 minutes,
et tous les cas à connexion refusée le consomment. TC-B16 purge les clés `ip:` en fin d'exécution ;
sans cela, la suite du run ne pourrait plus se connecter.

## Constats produit — section E

La section a été jouée **avant** correctif, puis rejouée après : quatre des huit cas sont
tombés au premier passage.

**AN-17 — Le mode « Dessiner un polygone » ajoutait aux sommets existants. _Corrigée._**
Une zone naît avec un carré par défaut autour de Casablanca. Activer le tracé puis cliquer les
quatre sommets de `Rabat Centre` donnait un polygone de **8 sommets** — les quatre du carré plus
les quatre voulus — c'est-à-dire une forme incohérente à cheval sur deux villes, enregistrée sans
le moindre avertissement. Entrer en tracé repart désormais d'une forme vide, le bouton devient
« Terminer le tracé », et en sortir sans enregistrer restaure la forme d'origine. **Tenue par TC-E01.**

**AN-18 — « Tous les livreurs sont affectés. » était un message inatteignable. _Corrigée._**
Le bouton **Ajouter** se désactivait quand plus aucun livreur n'était disponible : exactement le
moment où le message d'explication devait s'afficher. L'exploitant voyait un bouton gris, sans
raison. Le bouton reste cliquable, et le message fait son travail. **Tenue par TC-E03.**

**AN-19 — Une zone pouvait devenir anonyme. _Corrigée._**
`PATCH … { nameFr: '' }` répondait **200** : la zone restait en base, sans nom, donc introuvable
dans la liste de la console. Refus **400 « Nom de zone requis. »**. **Tenue par TC-E06.**

**AN-20 — Un polygone de deux sommets était accepté ; un livreur fantôme aussi. _Corrigées._**
Deux trous dans la même mise à jour :
- un polygone de moins de trois sommets ne délimite rien, disparaît de la carte (le rendu exige
  trois points) mais laissait la zone listée — un géofencing muet, sans alerte ;
- `drivers` acceptait n'importe quel nom, alors que le dispatch affecte les courses **par nom de
  chauffeur** : la zone pouvait porter un livreur que personne ne pourrait jamais joindre.
Les deux sont refusés en **400**, avec le nom fautif dans le message. **Tenues par TC-E07 et TC-E06.**

**Deux constats de cohérence, corrigés au passage.**
- Les libellés de l'éditeur de zone n'étaient **reliés à aucun champ** (`Text as="label"` sans
  `htmlFor`) : un lecteur d'écran annonçait des champs anonymes, et le libellé n'était pas
  cliquable. Le libellé enveloppe désormais son contrôle. *(Trouvé en écrivant TC-E01 — une
  recette qui ne peut pas viser un champ par son libellé signale souvent un défaut d'accessibilité,
  pas un défaut d'outillage.)*
- La suppression d'une zone passait par un `confirm()` **natif**, seul de toute la console : ni
  traduisible, ni thématisable, ni lisible en arabe RTL. Remplacé par un dialogue applicatif qui
  annonce ce qui sera perdu. **Vu dans TC-E04.**

## Constats produit — section F

Sept anomalies, dont trois qui rendaient une partie du produit inutilisable en clientèle.
Toutes corrigées, redéployées et reconfrontées le jour même.

**AN-22 — Les deux tiers de l'assistant de création partaient à la poubelle. _Corrigée._**
Contact, téléphone, adresse et notes des points de **retrait** et de **livraison** — deux écrans
entiers, tous champs marqués « requis » — n'étaient liés à aucun état, jamais transmis, et sans
colonne pour les accueillir. Une société de livraison créait donc des courses **sans adresse de
livraison** : ni le livreur, ni le suivi client, ni la preuve n'avaient de quoi travailler. Même
sort pour la description du colis et le type de véhicule.
*Correctif :* migration `0025`, champs pilotés et transmis, restitution sur la fiche commande.
**Tenue par TC-F01.**

**AN-21 — Une livraison pouvait être déclarée sans preuve. _Corrigée._**
La console désactivait bien « Faire progresser » à l'étape *En route (livraison)*, mais l'API
acceptait `LIVRAISON → LIVREE` sans photo ni signature. Un dispatcher pouvait donc clore une
course — et marquer un COD encaissé — sans rien à opposer à une contestation. L'app livreur, elle,
refusait déjà (`Progression impossible (livraison via preuve)`) : **la règle existait, la porte de
service était restée ouverte**. Refus **400** désormais, des deux côtés. **Tenue par TC-F06.**

**AN-25 — L'onglet « Historique » n'enregistrait rien. _Corrigée._**
Il **déduisait** le parcours en déroulant le chemin nominal jusqu'au statut courant : aucune date,
aucun acteur, et un parcours **inventé** dès qu'une commande sortait du nominal — une commande
annulée affichait fièrement les étapes par lesquelles elle n'était jamais passée. Or un litige COD,
une contestation de livraison ou un contrôle se tranchent sur des faits horodatés.
*Correctif :* table `order_events` (migration `0026`), écrite à chaque transition par
l'exploitation **et** par le terrain — une seule suite de faits, pas deux versions.
**Tenue par TC-F11.**

**AN-23 / AN-26 / AN-27 — Le portail marchand était livré sans porte, sans geste, et sans cloison. _Corrigées._**
Trois trous en enfilade sur la même brique :
- **AN-23** — aucun écran ne créait de compte marchand (`/users` ne proposait que les trois rôles
  console). Le portail existait, personne ne pouvait y entrer sans accès shell à la production.
- **AN-26** — le portail ne proposait **aucune création de commande**, alors que l'API autorisait
  le rôle MERCHANT et que c'est la raison d'être de l'espace. Un marchand devait téléphoner à son
  transporteur pour faire saisir sa propre course.
- **AN-27** — `POST /v1/orders` acceptait le champ `merchant` tel quel : un marchand pouvait
  déposer des commandes **au nom d'un concurrent du même tenant**, qui les aurait retrouvées dans
  sa facturation. L'identité vient désormais du compte, quoi qu'envoie le formulaire.
**Tenues par TC-F13.**

**AN-24 — Le bouton « copier » annonçait un succès sans rien copier. _Corrigée._**
`navigator.clipboard?.writeText(...)` : hors contexte sécurisé, l'appel optionnel ne faisait rien
et la coche verte s'affichait quand même. Le produit disposait pourtant déjà du repli
(`lib/clipboard.ts`, utilisé ailleurs) — la fiche commande ne l'avait jamais reçu. Un retour qui
ment est pire que pas de retour. **Tenue par TC-F11**, qui capte l'évènement `copy` du document.

**Trois constats corrigés au passage.**
- **Le proxy BFF perdait toute chaîne de requête.** Il encodait le dernier segment d'URL en bloc,
  si bien qu'un `?transferTo=…` arrivait en `%3FtransferTo=…` : le paramètre n'atteignait jamais
  l'API, sans le moindre message. Trouvé en rejouant TC-D11 ; corrigé pour tous les appels.
- L'assistant renvoyait vers la **liste** après création : à l'exploitant de deviner laquelle des
  lignes était la sienne. Il atterrit désormais sur la fiche créée.
- L'action de masse **Assigner** affectait en silence au **premier chauffeur de la liste**. Elle
  demande maintenant à qui affecter.

## Reste ouvert

- *(clos)* **TC-D11** — la règle a changé sur demande et a été rejouée en entier : un chauffeur
  porteur de courses en cours peut partir, à condition de désigner un repreneur.
- **TC-C03** — devise et fuseau horaire n'ont qu'une option (MAD, Africa/Casablanca) : leur
  persistance reste indémontrable tant qu'aucune seconde valeur n'existe.
- **OBS-09** — le presse-papiers n'est pas vérifiable tant que le homelab est servi en HTTP.
- **OBS-11 (nouveau, outillage)** — les specs de la section A ne sont pas rejouables en cours de
  run : elles supposent une base fraîche (TC-A08 attend une organisation encore en Essai). Celles
  des sections B, C et D normalisent désormais leur état de départ ; la section A reste à reprendre
  sur ce modèle.
