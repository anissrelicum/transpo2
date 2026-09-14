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

*(Section en cours de déroulé — verdicts et constats ajoutés au fil de l'exécution.)*
