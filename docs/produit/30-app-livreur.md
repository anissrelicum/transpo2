# App livreur

Application React Native / Expo (`apps/driver-app`), rôle `DRIVER`. Elle partage le
domaine (`@transpo/domain`), le client HTTP typé (`@transpo/api-client`) et l'échelle
visuelle (`@transpo/design-tokens`) avec le reste du mono-repo : un statut, une couleur ou
un montant s'y affichent exactement comme dans la console.

Toutes les routes `/v1/driver/*` sont **scopées au chauffeur du jeton**. Un livreur ne voit
ni les missions d'un collègue, ni les données de l'organisation ; les routes d'exploitation
lui répondent 403.

## Navigation

Cinq onglets en bas d'écran (`app/(tabs)/`) :

| Onglet | Écran | Rôle |
|---|---|---|
| Missions | `missions.tsx` | les courses du jour, écran par défaut |
| Tournée | `route.tsx` | l'ordre des arrêts |
| Scanner | `scan.tsx` | scan des colis par phase |
| Shift | `shift.tsx` | temps de conduite et partage de position |
| Profil | `profil.tsx` | fiche, disponibilité, accès aux écrans annexes |

Le reste est atteint depuis ces cinq écrans : détail de mission, statut, preuve, échec,
récap du jour, gains, incidents, support, notifications, objectifs, documents, aide,
paramètres, file de synchronisation.

L'action principale est collée en bas d'écran et les cibles tactiles font au moins 44 px.

## Connexion et autorisations — `app/index.tsx`

Deux étapes dans le même écran : identifiants (organisation, e-mail, mot de passe), puis
autorisations de l'appareil — GPS, caméra, notifications. Le bouton « Commencer ma
journée » reste fermé tant que les trois ne sont pas accordées.

> **Réserve connue (OBS-12).** Le refus affiche « Identifiants invalides ou serveur
> injoignable. » dans les deux cas. L'API distingue déjà les deux situations (401 contre
> absence de réponse) ; l'app ne le fait pas encore. Un livreur en zone blanche retape
> indéfiniment un mot de passe correct.

Un parcours d'**onboarding / recrutement** (`app/onboarding.tsx`, 4 étapes) est accessible
depuis « Devenir livreur ». Il n'appelle **aucun serveur** : les données saisies ne sont
jamais envoyées, et un bandeau le rappelle à chaque étape.

## Le parcours d'une mission

### Missions du jour — `app/(tabs)/missions.tsx`

Liste des commandes actives assignées au chauffeur, avec le nombre de courses et le COD à
encaisser. Tirer pour rafraîchir. Une bannière annonce l'état hors ligne et le nombre
d'actions en attente.

> La liste ne comporte ni distance ni compteur « livrées » : `Order` ne porte pas de
> coordonnées de livraison et l'API ne renvoie que les missions **actives** — la seconde
> carte résume donc le COD, entièrement dérivable des commandes, plutôt que d'inventer une
> donnée.

### Détail de mission — `app/mission/[ref]/index.tsx`

Contact, adresse, notes d'accès, taille du colis, puce COD et **niveau de preuve exigé par
cette commande**. « Naviguer » ouvre la progression de statut.

> **Deux réserves affichées à l'écran.** `Order` n'expose pas de coordonnées : la carte est
> remplacée par un emplacement explicite, jamais par des coordonnées inventées. Et le
> bouton « Contact » ouvre une fiche marquée « Contact non alimenté » — **il n'y a ni appel
> ni SMS réel**, donc aucun relais d'appel masquant le numéro du client. Le champ
> `dropPhone` existe pourtant dans la charge utile renvoyée au livreur : l'app ne l'affiche
> pas, mais elle le reçoit. Le message de la fiche (« l'API ne fournit pas de numéro
> client ») est donc plus catégorique que la réalité.

### Progression de statut — `app/mission/[ref]/status.tsx`

Machine à états séquentielle sur le chemin nominal : `ASSIGNEE → RETRAIT → RECUPEREE →
LIVRAISON`. **Chaque étape demande confirmation** avant d'être envoyée.

### Preuve et encaissement — `app/mission/[ref]/proof.tsx`

C'est l'écran qui ferme la course, et il porte la règle la plus stricte de l'app.

- **La validation reste fermée tant que la preuve manque**, et le bouton *nomme* ce qui
  manque : « Photo requise », puis « Signature requise », puis « Valider ». Le niveau vient
  de la commande (`aucune` / `photo` / `signature` / `photo_signature`), jamais d'un
  réglage global.
- Sur une commande à COD, **0 DH est refusé** ; le montant exact clôt la course, marque le
  COD encaissé et le porte à la caisse du jour du chauffeur.
- Sur une commande prépayée, il n'y a aucune étape d'encaissement — la fiche affiche
  « Prépayé » et la clôture est directe.
- Sur un niveau de preuve `aucune`, l'app le dit et la validation est ouverte d'emblée.
- **Un seul appel réseau** bundle le COD, la photo et la signature sous **une seule clé
  d'idempotence**. Ne jamais scinder en deux envois : un rejeu partiel produirait une
  livraison encaissée sans preuve, ou l'inverse.

Les photos sont redimensionnées et recompressées avant envoi (paliers 1280/1024/800 px)
pour tenir sous la borne d'environ 700 Ko par artefact — une photo brute de téléphone pèse
3 à 8 Mo et devrait tenir aussi dans la file hors ligne. La signature est produite en
**SVG** à partir des traits, sans dépendance native : la logique reste vérifiable hors
appareil.

### Échec de livraison — `app/mission/[ref]/fail.tsx`

Six motifs normalisés, motif **obligatoire** (400 côté API sinon), déclarable uniquement en
statut `LIVRAISON`. L'échec passe la commande en `ECHOUEE` et ouvre côté exploitation un
retour « À traiter » 1/3 portant le motif **et** les notes.

## Hors ligne

C'est le point de conception le plus structurant de l'app.

Une action du livreur est **écrite sur le disque d'abord**, puis tentée. Si le réseau
manque, elle reste en file et repart plus tard. Trois familles d'actions passent par la
file : `advance` (progression de statut), `proof` (preuve + COD, avec les artefacts déjà
compressés), `fail` (échec).

- **La clé d'idempotence est figée à la mise en file.** C'est ce qui rend le rejeu sûr, y
  compris après redémarrage de l'app : l'API dédoublonne dessus, et une reprise réseau ne
  produit **qu'une seule transition**. Sans cela, le compteur de tentatives d'un retour
  grimperait à chaque reprise.
- Les artefacts de preuve partent avec l'action : ils survivent à une coupure réseau comme
  à un redémarrage.
- **La file de synchronisation** (`app/sync-queue.tsx`) montre chaque action en attente,
  son contenu réel et la raison d'un blocage. Elle s'ouvre depuis le compteur « N action(s)
  en attente », pas seulement depuis la bannière « Hors ligne » : cette bannière disparaît
  dès que la connexion revient, y compris quand des actions restent bloquées (refus
  serveur, 5xx) — l'écran devenait injoignable précisément quand il servait.
- Hors ligne, forcer une action sans réseau est sans effet : elle est mise en file et
  annoncée comme telle.

Le **partage de position** (`lib/tracking.ts`) est délibérément **hors file** : une
position est périmée dès la suivante, un envoi qui échoue est abandonné plutôt que rejoué.
Le PC flotte n'affiche que la dernière position ; accumuler des points hors ligne
remplirait le stockage pour reconstituer un trajet dont personne n'a l'usage. Le suivi est
**au premier plan uniquement** (30 s ou 50 m minimum entre deux points) — le suivi en
arrière-plan demande une déclaration spécifique côté stores et un consentement distinct.

## Scanner — `app/(tabs)/scan.tsx`

Le scan suit la **phase** de la course : au retrait, les colis pas encore en main
(`ASSIGNEE`, `RETRAIT`) ; à la livraison, ceux qui sont dans le véhicule (`RECUPEREE`,
`LIVRAISON`). Compteur `n/total`, état vide annoncé.

Trois réponses possibles, et elles se distinguent :

- **Colis reconnu** — le scan au retrait fait avancer la mission et est visible côté
  exploitation ;
- **Déjà scanné** — le code est cherché dans **toute** la tournée avant d'être déclaré
  inconnu, sinon un colis déjà récupéré était annoncé « hors tournée », ce qui envoie un
  livreur chercher une erreur d'aiguillage inexistante ;
- **Colis hors tournée** — le code n'appartient à aucune de ses missions.

Un **succès s'efface seul** (on enchaîne) ; **un refus reste à l'écran jusqu'au scan
suivant**. Tous s'effaçaient après 1,6 s, et un livreur qui scanne à la chaîne ratait
exactement le seul message qui lui demandait de s'arrêter.

> **Le viseur caméra est simulé.** Lire un code-barres demande une bibliothèque native
> (ML Kit / ZXing) hors périmètre : c'est la **saisie manuelle du code à 8 caractères** qui
> agit, et un bandeau le dit à l'écran. En revanche les **données sont réelles** — la liste
> est celle des missions du livreur, phase par phase. Elle ne l'était pas : cinq colis
> `CMD-DEMO-0x` inventés étaient codés en dur, si bien qu'aucun vrai code ne passait.

## Shift et règle EU 561 — `app/(tabs)/shift.tsx`

Démarrage horodaté, compteur de conduite du jour, temps restant, repos estimé, et niveau
d'alerte réglementaire : `ok` → `pause` (après 4 h 30) → `warn` (30 min avant la limite) →
`limite` (9 h).

La règle est une **fonction unique du domaine** (`eu561Status()`), couverte par des tests
unitaires. L'écran l'affiche, il ne la recalcule plus : il redéfinissait auparavant ses
propres seuils en millisecondes, et deux copies d'une règle réglementaire finissent par
diverger — c'est celle de l'écran qui décidait de l'alerte montrée au conducteur.

Le bouton de shift est la **source de vérité du partage de position** : démarrer le shift
active le suivi, le terminer le coupe. L'écran Paramètres n'en montre qu'un badge en
lecture seule.

> **Deux limites à connaître.** Le chronomètre est **100 % local** (persisté sur
> l'appareil, remis à zéro chaque jour) : il n'existe aucun endpoint shift côté serveur, le
> temps de conduite ne remonte donc pas à l'exploitation. Et le seuil des 9 h n'est **pas
> atteignable en recette sur émulateur** — il est tenu par les tests unitaires du domaine,
> pas par un test sur appareil.

## Ma caisse — `app/recap.tsx`

Le récap du jour porte la caisse. Deux chiffres, et un seul vient du livreur :

- **Attendu** — les encaissements réellement enregistrés, calculés par le serveur ;
- **Ce que j'ai en main** — le seul chiffre que le livreur apporte, envoyé par
  `POST /v1/driver/cash/declare`.

Sans cette déclaration, la comptabilité ne rapprocherait que deux chiffres qu'elle a
elle-même produits. Un écart est annoncé au livreur (« l'exploitation va vous contacter »)
et ouvre le traitement décrit dans [la console](10-console-exploitation.md#reconciliation-cash-cash).

« Courses livrées », « Échecs » et « COD collecté » sont dérivés du cache de missions et de
la file hors ligne. « Gains estimés » applique le tarif réel (12 DH par livraison) au
nombre de livraisons ainsi compté : c'est une **estimation**, pas un montant confirmé par
le serveur.

> **Données de démonstration signalées** : distance parcourue et temps de conduite ne sont
> suivis nulle part dans l'app — le récap les affiche comme démonstration et le dit.

## Profil et disponibilité — `app/(tabs)/profil.tsx`

Véhicule, permis (numéro et échéance, avec badge calculé sur la **vraie** date), zone
affectée : tout vient de la fiche tenue par l'exploitation (`GET /v1/driver/me`). Ces
valeurs étaient écrites en dur (« Moto · 7890-B-12 ») — le livreur lisait le véhicule de
quelqu'un d'autre sur le seul écran censé porter le sien.

L'**interrupteur de disponibilité** envoie `PATCH /v1/driver/availability` et met à jour
`drivers.available`, que lit le score d'affectation du dispatch. Il n'était qu'un état
local : un livreur pouvait se déclarer indisponible, voir l'écran le confirmer, et
continuer de recevoir des courses. L'affichage revient en arrière si l'envoi échoue.

> **L'horaire du jour reste indicatif** : aucune notion d'horaire n'existe côté serveur, et
> l'écran le dit à cet endroit plutôt que de le noyer dans un bandeau « démonstration »
> global.

## Ma tournée — `app/(tabs)/route.tsx`

Deux sources, dans cet ordre :

1. la **tournée planifiée par l'exploitation** pour aujourd'hui (`GET /v1/driver/tour`),
   dont l'ordre des arrêts fait foi — c'est celui que le dispatch a optimisé et réordonné.
   L'écran l'annonce : « Ordre défini par le dispatch » ;
2. à défaut, les missions actives, dans l'ordre que le livreur choisit lui-même.

Seule la seconde existait : le dispatch pouvait optimiser une tournée sans que le livreur
n'en voie jamais l'ordre — deux plans de journée concurrents, dont un seul était décidé par
l'exploitation.

> **Réserve.** `Order` n'expose aucune coordonnée GPS : la distance et le temps estimé
> affichés sont calculés sur des **positions fictives déterministes**.

## Écrans annexes

| Écran | État |
|---|---|
| **Incidents** (`incidents.tsx`) | Réel. 5 types normalisés (`ADRESSE`, `CLIENT_INJOIGNABLE`, `COLIS_ENDOMMAGE`, `VEHICULE`, `AUTRE`), référence rendue au livreur, incident reçu par l'exploitation avec son type, son texte et son auteur. |
| **Support** (`support.tsx`) | Réel. Fil bidirectionnel avec le dispatch ; la réponse du dispatch apparaît dans le fil du livreur. |
| **Historique & gains** (`gains.tsx`) | Réel. Le COD encaissé est affiché **hors gains** et dit comme tel — il est encaissé pour le compte des marchands, pas rémunéré au livreur. Pas de filtre par période : `DriverHistory` n'expose pas de date par commande. |
| **Notifications** (`notifications.tsx`) | **Aucun backend.** Liste figée, signalée comme telle. |
| **Objectifs & primes** (`objectives.tsx`) | **Aucun endpoint.** Barème statique de démonstration, signalé par un bandeau. |
| **Mes documents** (`docs.tsx`) | **Statique.** Le téléversement n'appelle aucun serveur, et l'app le dit explicitement plutôt que de simuler un succès. |
| **Aide / FAQ** (`help.tsx`) | Contenu statique, recherche locale. Les réponses reflètent le domaine réel. |
| **Paramètres** (`settings.tsx`) | Notifications et langue persistées localement. **Pas de bascule clair/sombre** : le thème suit le système, et le socle n'expose pas de réglage — un bouton sans effet serait pire que son absence. |

## Bilingue FR/AR

Bascule FR → AR : textes en arabe, **mise en page inversée** (barre d'onglets en miroir),
redémarrage annoncé, montants isolés pour rester lisibles en contexte RTL, retour au
français effectif.

## Accessibilité

Les huit champs de saisie de l'app portent un `accessibilityLabel` et un `testID` : montant
encaissé, code colis, notes d'échec, incident, message au support, inscription, recherche
d'aide. Aucun ne l'avait hors écran de connexion — un lecteur d'écran n'annonçait qu'un
nombre nu sur le champ qui décide de l'argent remis au marchand.
