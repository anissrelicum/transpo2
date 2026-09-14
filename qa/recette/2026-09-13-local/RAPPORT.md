# Run 2026-09-13 — Recette section G (app livreur), environnement local

## Environnement — et pourquoi il a changé

Le run précédent (`2026-09-12-homelab`) se jouait sur le **homelab K8s**. Au moment de
reprendre la section G, les trois nœuds Talos étaient **injoignables** (`192.168.1.101-103`
muets, `transpo-api.wedowonders.com` en 530) : la recette ne pouvait pas continuer là-bas.

La section G a donc été jouée sur un environnement **local**, monté pour l'occasion :

| Élément | Valeur |
|---|---|
| API | `http://localhost:3000` (NestJS lancé sur l'hôte, `pnpm --filter @transpo/api start`) |
| Base | PostgreSQL 16 en conteneur (`docker compose up postgres`), migrations + catalogue de plans rejoués à neuf |
| App livreur | Expo Go sur émulateur Android `Medium_Phone_API_36.1` (Android 16), Metro sur l'hôte, `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` |
| Organisation | `rabatexpress` (plan Transporteur), provisionnée par `recette/amorcer.mjs` |
| Comptes | `admin@rabatexpress.ma`, `livreur@rabatexpress.ma` — mots de passe émis à l'amorçage, consignés dans [COMPTES.md](COMPTES.md) |

**Conséquence à connaître :** ce run valide le **produit**, pas le déploiement. Les correctifs
livrés ici devront être redéployés et reconfrontés sur le homelab dès qu'il sera rallumé
(section G à rejouer telle quelle : `node recette/run.mjs`).

## Rejouer

```bash
docker compose up -d postgres
DATABASE_URL=postgres://transpo:transpo_dev@localhost:5432/transpo pnpm --filter @transpo/db migrate
DATABASE_URL=... API_PORT=3000 pnpm --filter @transpo/api start &
node apps/driver-app/recette/amorcer.mjs        # organisation, flotte, comptes → COMPTES.md
cd apps/driver-app && pnpm start &              # Metro
adb reverse tcp:8081 tcp:8081                   # Expo Go joint Metro
RUN_ID=2026-09-13-local API_URL=http://localhost:3000 node recette/run.mjs        # les 18 cas
RUN_ID=2026-09-13-local API_URL=http://localhost:3000 node recette/run.mjs g07    # un seul
```

Aucune date ni aucun mot de passe n'est écrit en dur dans les cas : l'amorçage émet les
comptes et les cas relisent `COMPTES.md` (leçon d'OBS-05 du run précédent).

## Verdicts — section G

| Cas | Statut | Constat / anomalie | Preuve | Date |
|---|---|---|---|---|
| TC-G01 | OK | Connexion livreur → écran des autorisations. **→ OBS-12** (message d'erreur ambigu) | [TC-G01/](TC-G01/) | 13/09 |
| TC-G02 | OK | « Commencer ma journée » reste fermé à 0/3, 1/3, 2/3 ; s'ouvre à 3/3 | [TC-G02/](TC-G02/) | 13/09 |
| TC-G03 | OK | 3 missions du chauffeur listées, celle d'un autre **absente**, compteurs justes (3 · 750 DH), tirer pour rafraîchir effectif | [TC-G03/](TC-G03/) | 13/09 |
| TC-G04 | OK | Contact, adresse, notes d'accès, chips COD et niveau de preuve restitués ; « Naviguer » ouvre la progression | [TC-G04/](TC-G04/) | 13/09 |
| TC-G05 | OK | Chaque étape demande confirmation ; RETRAIT → RECUPEREE → LIVRAISON vus côté exploitation | [TC-G05/](TC-G05/) | 13/09 |
| TC-G06 | OK | Validation fermée tant que la preuve manque, et le bouton NOMME ce qui manque (Photo requise → Signature requise → Valider) | [TC-G06/](TC-G06/) | 13/09 |
| TC-G07 | OK | 0 DH refusé (validation fermée), montant exact → Livrée + COD encaissé + porté à la caisse du chauffeur. **→ OBS-13** (aucune session de caisse ouverte) | [TC-G07/](TC-G07/) | 13/09 |
| TC-G08 | OK | Commande prépayée : fiche « Prépayé », aucune étape d'encaissement, clôture directe | [TC-G08/](TC-G08/) | 13/09 |
| TC-G09 | OK | Preuve « aucune » : l'app le dit, la validation est ouverte d'emblée, la clôture aboutit | [TC-G09/](TC-G09/) | 13/09 |
| TC-G10 | OK | 6 motifs normalisés, confirmation, statut Échouée, retour ouvert « À traiter » 1/3 avec motif **et** notes | [TC-G10/](TC-G10/) | 13/09 |
| TC-G11 | OK | Hors ligne : liste conservée, action mise en file et annoncée, forçage sans réseau sans effet, **rejeu automatique au retour du réseau, une seule transition** (idempotence). **AN-28 corrigée** | [TC-G11/](TC-G11/) | 13/09 |
| TC-G12 | OK | Scanner : colis reconnu / doublon / hors tournée, compteur n/total juste, scan au retrait déclaré côté exploitation. **AN-29, AN-30, AN-31 corrigées** | [TC-G12/](TC-G12/) | 13/09 |
| TC-G13 | OK | Shift : démarrage horodaté, compteurs de conduite qui avancent puis se figent à l'arrêt. Paliers EU 561 **non atteignables sur émulateur** → tenus par tests unitaires. **AN-32 corrigée** | [TC-G13/](TC-G13/) | 14/09 |
| TC-G14 | OK | 5 types normalisés, référence rendue au livreur, incident reçu par l'exploitation avec type, texte et livreur | [TC-G14/](TC-G14/) | 14/09 |
| TC-G15 | OK | Message reçu côté exploitation, réponse du dispatch visible dans le fil du livreur | [TC-G15/](TC-G15/) | 14/09 |
| TC-G16 | OK | 3 livraisons, 36 DH de gains à 12 DH/course, COD encaissé présenté **hors gains** et dit comme tel | [TC-G16/](TC-G16/) | 14/09 |
| TC-G17 | OK | Non-lues remises à zéro ; disponibilité déclarée par le livreur **vue par le dispatch**, dans les deux sens. **AN-33, AN-34 corrigées** | [TC-G17/](TC-G17/) | 14/09 |
| TC-G18 | OK | FR → AR : textes en arabe, redémarrage annoncé, **mise en page inversée** (barre d'onglets miroir), montants isolés donc lisibles, retour au français effectif | [TC-G18/](TC-G18/) | 14/09 |
| TC-I05 | OK | *(cas ajouté, mobile)* La tournée du jour planifiée et réordonnée par le dispatch s'affiche **dans son ordre** côté livreur, annoncée comme telle. **AN-40 corrigée** | [TC-I05/](TC-I05/) | 14/09 |

**Rejeu intégral de la section G le 14/09 : 18/18.** Deux cas (TC-G10, TC-G12) sont tombés au
premier passage pour cause d'interférence d'environnement — une suite web tournait en parallèle
sur la même machine et la même base — et passent au rejeu isolé. C'est une leçon d'outillage :
sur un poste unique, la recette mobile et la recette web ne partagent ni la machine ni la base.

## Constats produit — section G

Huit anomalies. Toutes corrigées et reconfrontées dans le même run.

**AN-28 — L'écran de synchronisation devenait injoignable dès le retour du réseau. _Corrigée._**
`/sync-queue` n'était atteignable que par le bandeau **« Hors ligne »**. Or ce bandeau disparaît
dès que la connexion revient — y compris quand des actions restent bloquées en file (refus
serveur, 5xx). Le livreur voyait alors « 1 action(s) en attente » sans **aucun** moyen d'ouvrir
la file pour savoir laquelle ni pourquoi : l'écran existait, était traduit, et n'était plus
accessible précisément quand il servait. Le compteur mène désormais à la file.
`apps/driver-app/app/(tabs)/missions.tsx`. **Tenue par TC-G11.**

**AN-29 — Le scanner ne scannait aucun colis réel. _Corrigée._**
L'onglet Scanner travaillait sur cinq colis inventés (`CMD-DEMO-01` … `05`) codés en dur. Un
livreur qui scannait **ses** colis obtenait « Colis hors tournée » à chaque fois, et les colis
listés n'étaient ceux de personne. Le viseur caméra simulé est une réserve documentée (PRD §9.2,
pas de lib native) ; le jeu de données figé n'en était pas une : le PRD Lot 3 §5.12 décrit
« la liste des colis de la tournée ». La liste vient maintenant des missions du livreur, phase
par phase (retrait / livraison), avec son état vide annoncé.
**Tenue par TC-G12** (qui vérifie qu'aucun `CMD-DEMO` ne subsiste).

**AN-30 — Un colis déjà récupéré était annoncé « hors tournée ». _Corrigée._**
Conséquence du correctif précédent : une fois scanné au retrait, le colis change d'étape et
quitte la liste courante. Le rescanner renvoyait « Colis hors tournée » — le message qui envoie
un livreur chercher une erreur d'aiguillage inexistante. Le code est désormais cherché dans
**toute** la tournée avant d'être déclaré inconnu : c'est un « Déjà scanné ». **Tenue par TC-G12.**

**AN-31 — Un refus de scan s'effaçait au bout de 1,6 s. _Corrigée._**
Succès, doublon et hors-tournée disparaissaient tous après 1,6 s. Un livreur qui scanne à la
chaîne rate exactement le seul message qui lui demandait de s'arrêter. Le succès continue de
s'effacer seul (on enchaîne) ; **un refus reste à l'écran jusqu'au scan suivant**. **Tenue par TC-G12.**

**AN-32 — La règle EU 561 existait en deux exemplaires. _Corrigée._**
`packages/domain` portait `EU561_MAX_DRIVE_HOURS` et `EU561_BREAK_MIN`, et l'écran Shift
redéfinissait ses propres seuils en millisecondes (`MAX_DRIVE_MS`, `PAUSE_AFTER_MS`,
`WARN_BEFORE_MS`). Deux copies d'une règle **réglementaire** finissent par diverger, et c'est
la copie de l'écran qui décide de l'alerte affichée au conducteur. La règle est maintenant une
fonction unique `eu561Status()` dans le domaine, couverte par
`packages/domain/src/eu561.test.ts` (5 tests : pause à 4h30, alerte à 8h30, limite à 9h, restant
jamais négatif, repos jamais négatif). L'écran l'affiche, il ne la recalcule plus.

**AN-33 — Le profil du livreur affichait le véhicule de personne. _Corrigée._**
L'écran Profil annonçait « Moto · 7890-B-12 », « A, B · exp. 09/2028 », « Casablanca — Maârif » :
des valeurs **écrites en dur**, sur le seul écran censé porter la fiche du livreur — alors que
la fiche réelle (véhicule rattaché, n° et échéance de permis, zone affectée) existe côté
exploitation depuis la section D. Un nouvel endpoint `GET /v1/driver/me` rend au livreur ce que
l'exploitation tient sur lui ; l'écran l'affiche, badge de permis calculé sur la **vraie**
échéance. Seul l'horaire reste indicatif — aucune notion d'horaire n'existe côté serveur, et
l'écran le dit désormais au lieu de le noyer dans un bloc « démonstration » global.

**AN-34 — L'interrupteur de disponibilité ne quittait pas le téléphone. _Corrigée._**
« Disponible » n'était qu'un `useState` local : un livreur pouvait se déclarer indisponible,
voir l'écran le confirmer, et continuer de recevoir des courses — le score d'affectation du
dispatch lit `drivers.available`, que rien ne mettait à jour. L'interrupteur mentait au seul qui
pouvait s'y fier. `PATCH /v1/driver/availability` (scope = le chauffeur du jeton) le porte
maintenant jusqu'à la console, avec retour en arrière de l'affichage si l'envoi échoue.
**Tenue par TC-G17**, qui confronte les deux sens à `/v1/drivers`.

**AN-35 — Aucun champ de saisie de l'app n'était annonçable. _Corrigée._**
Hors écran de connexion, **aucun** `TextInput` de l'app livreur ne portait de libellé
d'accessibilité : montant encaissé, code colis, notes d'échec, incident, message au support,
inscription, recherche d'aide. Le pire est le **montant du COD** : ni libellé, ni repère, ni même
un texte d'invite — un lecteur d'écran n'y annonçait qu'un nombre nu, sur le champ qui décide de
l'argent remis au marchand. Huit champs reçoivent `accessibilityLabel` + `testID`.
*(Trouvé en écrivant TC-G07 : une recette qui ne peut pas viser un champ par son libellé signale
presque toujours un défaut d'accessibilité, pas un défaut d'outillage — même leçon qu'en section E.)*

### Observations

**OBS-12 — Le refus de connexion ne distingue pas le mot de passe du réseau.**
L'app affiche « Identifiants invalides ou serveur injoignable. » dans les deux cas. Un livreur en
zone blanche retape indéfiniment un mot de passe correct ; un livreur au mauvais mot de passe
accuse le réseau. L'API, elle, distingue déjà (401 contre absence de réponse). Sévérité **faible**
en sécurité — le message générique protège de l'énumération (cf. OBS-01) — mais **moyenne** en
usage terrain. *Piste :* séparer l'échec réseau (« Serveur injoignable ») du refus
d'identifiants, sans détailler lequel des deux champs est faux.

**OBS-13 — Encaisser n'ouvre aucune session de caisse.**
Après TC-G07, le COD encaissé est bien porté au **théorique** du chauffeur
(`/v1/cash/reconciliation`), mais **aucune session** n'existe dans `/v1/cash/sessions` : le
déclaré, le dépôt et l'écart n'ont donc aucun support tant qu'une session n'est pas créée par
ailleurs. À confronter en **section L** (TC-L01 attend « une session au nom du chauffeur »).
Sévérité **à qualifier en section L**.

**OBS-14 — Le seuil des 9 h de conduite n'est pas atteignable en recette mobile.**
Le vérifier demanderait d'avancer l'horloge du téléphone : refusé sur une image Android de
production (`adbd cannot run as root`), et déplacer l'horloge de l'hôte n'est pas acceptable.
Les paliers sont donc tenus par des **tests unitaires** de domaine, et TC-G13 vérifie ce qui
s'observe réellement sur l'appareil. Sévérité **nulle côté produit** (outillage) — mais à savoir :
ce n'est pas un trou de couverture, c'est un déplacement du niveau de vérification.

## Constats d'outillage — le harnais mentait avant le produit

Six défauts du harnais `adb` ont été corrigés ; chacun fabriquait de **faux verdicts**, ce qui
est plus grave qu'un cas qui ne passe pas.

1. **Frappe incomplète non détectée.** `input text` envoie les caractères plus vite que le champ
   React Native ne se re-rend : `livreur@rabatexpress.ma` arrivait en `livreur@rabatexpr`, et
   TC-G01 concluait « identifiants invalides ». La saisie est désormais **découpée et relue**,
   avec trois essais et un échec explicite.
2. **Un motif trop large visait le mauvais bouton.** Dans l'appareil photo, `/Capture/i`
   correspondait au conteneur `sticky_bottom_capture_layout` — plein écran — avant le vrai
   déclencheur : le harnais appuyait au milieu de la visée et concluait que l'appareil ne
   déclenchait pas.
3. **Le `?` était mangé par le shell du téléphone.** « que faire ? » arrivait en « que faire d » :
   le texte traverse un shell, qui développe les caractères de motif. Échappés désormais, comme
   les accents sont refusés explicitement (`input text` ne sait pas les taper — il fait tomber le
   service d'entrée d'Android avec une trace Java qui n'a aucun rapport).
4. **L'effacement d'un champ multiligne ne remontait qu'en fin de ligne**, si bien que les essais
   s'empilaient. On efface maintenant dans les deux sens.
5. **Les entités XML n'étaient pas décodées** : « Historique & gains » arrivait en
   « Historique &amp; gains », introuvable — le cas concluait à un écran manquant.
6. **Le harnais ne parlait que français.** Déconnexion, autorisations : un cas bilingue
   interrompu laissait toute la suite face à un écran arabe et produisait une cascade de faux KO.
   `ouvrirApp()` **remet l'app en français** par défaut, et les cas bilingues demandent l'arabe
   explicitement.

## Reste ouvert

- **Redéployer sur le homelab** dès qu'il est rallumé, et rejouer la section G en entier : ce run
  valide le produit, pas le déploiement.
- **OBS-13** — la session de caisse du livreur, à trancher en section L.
- **Scanner : le viseur caméra reste simulé** (réserve PRD §9.2). Les données sont réelles, la
  lecture optique ne l'est pas : c'est la saisie manuelle du code à 8 caractères qui agit.
- **Sections H à T** non jouées dans ce run (consoles web) — elles supposent l'environnement
  complet (console Next.js + Playwright), incompatible en mémoire avec l'émulateur sur ce poste.

---

# Sections H à T — environnement local (suite du run)

Le homelab restant éteint, les sections consoles sont jouées sur le même environnement
local : API sur l'hôte (`http://localhost:3000`), console Next.js (`http://localhost:3001`),
PostgreSQL en conteneur. Le harnais Playwright n'était jusqu'ici jouable **que** sur le
cluster — `sql()` passait par `kubectl exec` en dur. Il prend maintenant `PG_EXEC` :

```bash
apps/e2e-web/lancer-recette-locale.sh          # toutes les sections
apps/e2e-web/lancer-recette-locale.sh h01 k02  # quelques cas
```

## Verdicts — sections H à T

| Cas | Statut | Constat / anomalie | Date |
|---|---|---|---|
| TC-H01 | OK | Le colis scanné entre dans **Arrivés — à scanner**, les indicateurs suivent, le champ se vide pour le suivant. **AN-36 corrigée** | 14/09 |
| TC-H02 | OK | Bouton fermé à 7 caractères ; code inconnu refusé avec un message explicite, rien n'entre au hub | 14/09 |
| TC-H03 | OK | Arrivés → Scannés — à trier → Sur quai, regroupé par ville, phase persistée à chaque geste | 14/09 |
| TC-H04 | OK | Manifeste complet, total COD embarqué exact. **→ AN-37** : sceller ne laisse aucune trace | 14/09 |
| TC-H05 | OK | Comptable : aucun geste d'exploitation proposé, et `POST /v1/hub/scan` refusé 403 | 14/09 |
| TC-J01 | OK | La dernière position remontée par le terrain est celle qu'affiche le PC flotte | 14/09 |
| TC-J03 | OK | Géofence à 3 km : position dans la zone silencieuse, position à 60 km → bandeau « sorti de zone » + `/tracking/alerts` | 14/09 |
| TC-J04 | OK | Plein écran et retour, « Gérer les zones » mène à `/zones` | 14/09 |
| TC-M01 | OK | Supplément modifié, « Enregistré ✓ », valeur persistée après rechargement. **AN-39 corrigée** (libellés reliés aux champs) | 14/09 |
| TC-M02 | OK | Cascade de tarification confrontée dans ses deux branches (remisée / standard). **→ OBS-15** : le simulateur affiche un prix remisé par défaut | 14/09 |
| TC-M03 | OK | `grille-tarifaire.csv` téléchargé, une ligne par palier | 14/09 |
| TC-N01 | OK | Portail borné au marchand du compte, aucune commande d'un autre marchand, API alignée | 14/09 |
| TC-N04 | OK | `/dashboard`, `/orders`, `/cash` fermés au marchand ; 4 endpoints d'exploitation en 403 | 14/09 |
| TC-O01 | OK | Suivi public par code : statut et étapes, **aucun téléphone, aucune adresse, aucun nom de livreur** ; code inconnu → 404 | 14/09 |
| TC-O03 | OK | Note enregistrée une fois ; seconde note refusée ; notation d'une commande non livrée refusée | 14/09 |
| TC-P01 | OK | Journal alimenté par l'envoi manuel, destinataire et statut visibles | 14/09 |
| TC-P04 | OK | Marketing sans consentement bloqué (09-08), transactionnel passé, consentement retiré de nouveau opposable | 14/09 |
| TC-P05 | OK | Modèle modifié, variables réellement substituées, rétablissement effectif | 14/09 |
| TC-R01 | OK | Les compteurs du tableau de bord valent ceux de la base ; alertes de conformité conformes | 14/09 |
| TC-R02 | OK | Motifs d'échec repris du terrain, chauffeurs livrant tous présents à l'onglet « Par livreur » | 14/09 |
| TC-S02 | OK | En-tête `x-tenant-slug` d'un autre tenant → 403 ; aucune écriture ne franchit la cloison | 14/09 |
| TC-S05 | OK | Provisioning, invitations, réinitialisations tracés ; aucune entrée sans acteur ni date | 14/09 |
| TC-S07 | OK | Cookie supprimé → renvoi au formulaire de connexion, aucun contenu servi | 14/09 |
| TC-T03 | OK | 1024 px et 768 px sur `/orders`, `/dispatch`, `/cash` : aucun débordement horizontal | 14/09 |
| TC-T04 | OK | 21 pages d'un tenant neuf : aucun écran blanc, aucune erreur JavaScript | 14/09 |
| TC-T05 | OK | Même libellé de statut sur la liste, la fiche et le suivi client | 14/09 |
| TC-I02 | OK | Optimisation annoncée et **persistée** ; bouton fermé sous 2 arrêts | 14/09 |
| TC-I04 | OK | Planifiée → En cours → Clôturée ; réordonnancement et relance d'une tournée close refusés **400**. **AN-42 corrigée** | 14/09 |
| TC-K01 | OK | L'échec du terrain ouvre un retour « À traiter » 1/3 avec son motif et ses notes | 14/09 |
| TC-K02 | OK | Reprogrammation → 2/3, et la commande **redevient livrable** (statut LIVRAISON, livreur conservé) | 14/09 |
| TC-K03 | OK | Au plafond : message explicite, bouton absent, API refusée 400 | 14/09 |
| TC-K04 | OK | Rendu au marchand, ligne basculée en « Clôturés », **reprogrammation et re-restitution refusées 400**. **AN-41 corrigée** | 14/09 |
| TC-L01 | OK | Deux encaissements du terrain → une session au nom du chauffeur, théorique = somme, mouvements traçables à la course. **AN-43 corrigée** | 14/09 |
| TC-L02 | OK | Dépôt en agence = montant déclaré ; second dépôt refusé 400 | 14/09 |
| TC-L04 | OK | `reconciliation-cash.csv` téléchargé, sessions affichées dedans | 14/09 |
| TC-L07 | OK | Dispatcher : 5 écritures sur la caisse et les reversements refusées 403 | 14/09 |
| TC-N02 | OK | Commandes et portefeuille bornés au marchand, COD encaissé conforme | 14/09 |
| TC-O04 | OK | L'avis remonte avec sa note, sa commande, son chauffeur et son marchand | 14/09 |
| TC-P06 | OK | Création et mise en livraison notifient le client, code de suivi substitué. **AN-44 corrigée** | 14/09 |
| TC-R03 | OK | Commandes, caisse et réconciliation comptent le même argent | 14/09 |
| TC-S01 | OK | 15 pages parcourues : aucune donnée du tenant voisin | 14/09 |
| TC-S03 | OK | Jeton livreur borné à son chauffeur ; 4 routes d'exploitation en 403 | 14/09 |
| TC-S06 | OK | Export complet (courses comprises) puis effacement : données personnelles disparues, commandes conservées. **AN-45 corrigée** | 14/09 |
| TC-T01 | OK | Bascule FR → AR, RTL, langue conservée d'une page à l'autre | 14/09 |
| TC-I03 | OK | Arrêt descendu à la main, ordre **persistant** après rechargement | 14/09 |
| TC-L03 | OK | Écart **déclaré par le livreur** (700 attendus, 600 en main), annoncé à la comptabilité, résolu avec motif et note, session clôturée. **AN-46 corrigée** | 14/09 |
| TC-L05 | OK | Reversements générés (brut − commission = net), paiement avec méthode et référence, second paiement refusé 400 | 14/09 |
| TC-Q01 | OK | L'écart de caisse résolu **ouvre un cas de fraude** (signal `ecart_cash`, score 30) et alimente le classement. **AN-47 corrigée** | 14/09 |
| TC-Q02 | OK | Ouvert → Enquête → Confirmé (confirmation explicite), et Blanchi sur un second cas ; décisions tracées au journal d'audit | 14/09 |
| TC-Q05 | OK | Dispatcher : `/fraud` fermé, `cases` et `leaderboard` en 403 | 14/09 |

## Constats produit — sections H à T

**AN-36 — La première colonne du tri en hub ne pouvait jamais se remplir. _Corrigée._**
« Enregistrer l'entrée » posait directement la phase `trier` : le colis sautait la colonne
**Arrivés — à scanner**, et l'indicateur « À scanner » restait structurellement à zéro sur un
tenant réel (seul le jeu de démonstration en posait). Le hub affichait donc trois colonnes dont
une morte, et l'agent n'avait aucun moyen de distinguer ce qui vient d'arriver de ce qui est déjà
scanné. Le scan déclare l'arrivée ; le tri reste un second geste. *Au passage :* une course
livrée, annulée ou déjà en retour n'entre plus au hub — elle serait apparue au manifeste de
transfert, COD compris. **Tenue par TC-H01 et TC-H03.**

**OBS-15 — Le simulateur de devis affiche un prix REMISÉ par défaut. _Ouverte._**
TC-M02 a d'abord semblé révéler un bug : 51,84 DH à l'écran contre 57,60 DH par l'API pour
9 km. La suite E2E d'API a tranché l'inverse — la remise est **contractuelle par marchand**
(cascade prix fixe > grille remisée > grille standard), et l'appliquer par défaut aurait remisé
les courses de marchands sans accord. Mon correctif a donc été **annulé**. Ce qui reste vrai :
la case « Remise contractuelle » du simulateur est **cochée par défaut**, si bien que le grand
« Total TTC » affiché n'est pas le tarif standard. Un dispatcher qui lit vite annonce un prix
remisé à un client qui n'y a pas droit. Sévérité **faible à moyenne**. *Piste :* décocher par
défaut, ou nommer le prix affiché (« TTC remisé −10 % »). **À arbitrer.**

**AN-39 — Les libellés de la grille tarifaire n'étaient reliés à aucun champ. _Corrigée._**
Même défaut que celui corrigé sur l'éditeur de zones en section E : « Supplément fragile »,
« Remise standard », « TVA » étaient posés **à côté** de leur champ. Un lecteur d'écran
annonçait quatre champs anonymes, et cliquer le libellé ne faisait rien. Chaque libellé
enveloppe maintenant son contrôle. *(Trouvé, là encore, parce que la recette ne pouvait pas
viser le champ par son nom — le même signal qu'en sections E et G.)*

**AN-47 — Aucun cas de fraude n'était jamais créé. _Corrigée._**
Le barème `FRAUD_SIGNALS` (six signaux pondérés) existait dans le domaine et **rien ne
l'appelait** : `fraud_cases` n'était remplie que par le jeu de démonstration, si bien que
`/fraud` restait vide quoi qu'il arrive sur le terrain — écart de caisse, livraison hors zone,
dépôt tardif. Deux signaux réels l'alimentent désormais : l'écart constaté à la résolution d'une
caisse, et la preuve de livraison déposée hors de la géofence du livreur. Un seul cas ouvert par
livreur, les signaux s'y accumulent, le score suit le barème, et l'arbitrage humain reste entier
(rien n'est automatique). **Tenue par TC-Q01 et TC-Q02.**

**AN-46 — Les motifs d'écart de caisse n'étaient pas nommés. _Corrigée._**
Troisième occurrence du même défaut dans la soirée (après l'éditeur de zones en section E et la
grille tarifaire en TC-M01) : les cinq motifs de résolution étaient des boutons radio posés à
côté de leur texte. Un lecteur d'écran annonçait cinq choix anonymes, et cliquer le libellé ne
cochait rien — il fallait viser le cercle. **Tenue par TC-L03.**

**AN-43 — Encaisser un COD n'ouvrait aucune caisse. _Corrigée._**
`cash_sessions` n'était alimentée que par le jeu de démonstration : sur un tenant réel,
`/cash` affichait « Aucune session de caisse aujourd'hui » pendant que des milliers de dirhams
circulaient en tournée. Le théorique existait (calculé à la volée par la réconciliation), mais
**ni le déclaré, ni le dépôt, ni l'écart n'avaient de support** — toute la section L était sans
objet. La preuve de livraison alimente maintenant la caisse du jour du livreur, mouvement par
mouvement (une course = une ligne traçable), et le livreur **déclare** ce qu'il a réellement en
main depuis son récap (`POST /v1/driver/cash/declare`). Sans cette déclaration, la comptabilité
ne rapprochait que deux chiffres qu'elle avait elle-même produits. **Tenue par TC-L01 à TC-L03.**

**AN-44 — Aucun événement de course ne notifiait le client. _Corrigée._**
Le catalogue de modèles bilingues, le journal, les consentements 09-08 : tout existait, et
**rien ne s'y déversait** — seuls les envois manuels d'un opérateur peuplaient le journal. Un
client n'était donc prévenu ni de l'enregistrement de son colis, ni de sa mise en livraison, ni
de sa livraison, ni de son échec. Les quatre événements notifient désormais le destinataire, en
respectant la règle de consentement (transactionnel exempté). Envois **après** l'écriture et
jamais bloquants : une notification qui échoue ne fait pas échouer une course. **Tenue par TC-P06.**

**AN-45 — L'effacement Loi 09-08 laissait les données de la personne sur ses courses. _Corrigée._**
`POST /v1/privacy/erase` ne touchait que les consentements et les notifications. Or c'est la
**course** qui détient l'essentiel : contact, téléphone, adresse, instructions d'accès. Après un
effacement, la fiche commande affichait toujours le numéro du destinataire, et le suivi client
continuait de servir ces champs. Les courses sont maintenant **anonymisées sans être supprimées**
— la commande reste due, facturée et comptée ; c'est la personne qui disparaît, pas l'écriture
comptable. L'export de portabilité rend lui aussi les courses. **Tenue par TC-S06.**

**AN-41 — Un retour rendu au marchand pouvait être reprogrammé. _Corrigée._**
La console masquait bien l'action, mais l'API acceptait `reschedule` et `return-to-merchant` sur
un retour déjà **RENDU** : le colis serait repassé « en cours de livraison » alors qu'il est
physiquement reparti chez le marchand. Refus **400** des deux côtés. **Tenue par TC-K04.**

**AN-42 — Une tournée clôturée restait modifiable par l'API. _Corrigée._** Réordonner une
tournée close réécrit la journée d'hier ; l'écran l'interdisait, pas le serveur. **Tenue par TC-I04.**

**AN-40 — La tournée planifiée par le dispatch n'atteignait jamais le livreur. _Corrigée._**
L'exploitation crée une tournée, l'optimise (TC-I02), la réordonne à la main (TC-I03) — et
l'écran « Ma tournée » du livreur retriait ses missions par une **heuristique locale** sur des
positions fictives. Deux plans de journée coexistaient, dont un seul était décidé par
l'exploitation, et ce n'était pas celui que le livreur suivait. `GET /v1/driver/tour` rend les
arrêts dans l'ordre de la tournée du jour, l'écran les affiche ainsi et l'annonce
(« Ordre défini par le dispatch »). À défaut de tournée planifiée, le livreur garde la main sur
son ordre. **Tenue par TC-I05.**

**AN-37 — Sceller un bordereau de transfert ne laisse aucune trace. _Ouverte._**
« Sceller le bordereau » ferme le dialogue et **ne fait rien d'autre** : aucun manifeste n'est
enregistré, les colis restent « sur quai », et le même bordereau peut être scellé indéfiniment.
Le hub n'a donc aucune trace de ce qui est parti, ni le destinataire de quoi contrôler ce qui
arrive. Le plan de test n'attendait que la fermeture du dialogue — le cas passe — mais un
transfert interurbain sans document opposable est un trou d'exploitation. Sévérité **moyenne**.
*Piste :* un manifeste numéroté, horodaté et scellé (table dédiée), les colis passant « en
transfert » ; réception à destination par le même numéro. **À arbitrer** : c'est une brique
produit, pas une correction — d'où le choix de la consigner plutôt que de l'inventer.


## Suite E2E d'API — ce qu'elle a tranché

Les sections consoles ont été confrontées à la suite `apps/e2e` (91 cas, API réelle) pour ne
pas laisser un correctif de recette casser un contrat établi ailleurs. Elle a **corrigé une de
mes conclusions** :

- **Le devis n'avait pas de bug.** TC-M02 avait relevé 51,84 DH à l'écran contre 57,60 DH par
  l'API, et j'en avais conclu que la remise du tenant n'était pas transmise. La suite dit
  l'inverse : `40_cash_billing.test.mjs` fixe une **cascade** — prix fixe marchand > grille
  remisée > grille standard — où la remise est **contractuelle, par marchand**, passée à chaque
  devis. L'appliquer par défaut aurait remisé les courses de tous les marchands, y compris ceux
  sans accord. Correctif annulé. Ce qui reste vrai, c'est que le **simulateur affiche un prix
  remisé par défaut** (case cochée) : le grand « Total TTC » n'est pas le tarif standard, et rien
  ne le dit à qui lit vite. → **OBS-15**, à arbitrer (décocher par défaut, ou nommer le prix).

Deux cas de cette suite ne passaient que sur une base **neuve** — et verdissaient à tort ensuite :
clés d'idempotence fixes (`ADV1`) donc globales au tenant, et consentement marketing accordé par
le cas suivant sans jamais être repris. Corrigés : la clé est désormais propre à la course, et le
cas de blocage repart d'un refus explicite. **82 cas sur 91** passent sur une base déjà servie ;
les 9 restants butent sur des données laissées par les passages précédents (plans purgés, tenant
déjà suspendu, compteur d'anti-bruteforce, commande déjà notée) — même famille, à reprendre.

## Passe complète des sections H à T

Les 51 cas écrits ont été rejoués **d'une traite**, dans l'ordre : **49 verts**. Les deux
derniers (TC-Q01, TC-Q02) passent isolément mais dépendaient de la caisse laissée par la
section L — ils posent désormais leur propre décor (une livraison encaissée, mise en écart),
comme tous les autres. C'est la même leçon que celle de la nuit : *un cas qui emprunte l'état
d'un autre ne se rejoue pas*.

## Ce qui reste à faire

1. **Redéployer sur le homelab** et rejouer les sections G à T : ce run valide le produit, pas le
   déploiement.
2. **AN-37** (manifeste de transfert sans trace) et **OBS-15** (prix remisé par défaut au
   simulateur) : deux décisions produit, délibérément non tranchées ici.
3. Les 9 cas d'API non rejouables sur base servie, à remettre au modèle des deux qui l'ont été.
