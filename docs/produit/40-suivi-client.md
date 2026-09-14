# Suivi client

Le client final n'a pas de compte. Il suit son colis avec le **code à 8 caractères** que
son marchand lui a transmis (ou qu'il a reçu par notification), et il peut noter la
livraison une fois celle-ci terminée.

## L'application

`apps/client-app` — React Native / Expo, deux écrans :

| Écran | Fichier | Contenu |
|---|---|---|
| Accueil | `app/index.tsx` | saisie du code de suivi |
| Suivi | `app/track/[code].tsx` | statut, étapes franchies, notation si livré |

Le tenant est porté par la configuration de l'application (`app.json` →
`extra.defaultTenant`, `casaexpress` par défaut) : une application par transporteur, ou une
application dont le tenant est fixé au build. Il n'y a pas de sélecteur d'organisation
dans l'interface.

## Les endpoints publics

Deux routes, **sans authentification**, avec le tenant dans l'URL :

```
GET  /v1/public/track/:slug/:code
POST /v1/public/track/:slug/:code/rate
```

Le slug est validé côté serveur contre `platform.tenants` ; un tenant inconnu comme un code
inconnu renvoient la même chose : 404 « Suivi introuvable. »

## Ce que le suivi expose — et ce qu'il n'expose pas

C'est la partie qui compte, parce que c'est une page ouverte à qui possède un code.

**Exposé** : le code, le statut et son libellé, la couleur, la ville de départ, la ville
d'arrivée, la liste des étapes du cycle de vie avec celles déjà franchies, l'indication de
livraison, et la note déjà laissée le cas échéant.

**Jamais exposé** : aucun numéro de téléphone, aucune adresse, aucun nom de livreur, aucun
nom de marchand, aucun montant. La vérification est un cas de recette à part entière
(TC-O01).

Les étapes affichées sont celles du **chemin nominal** (`PROGRAMMEE` → … → `LIVREE`).
Une commande échouée, retournée ou annulée est marquée terminale sans que son parcours
d'échec soit détaillé au client.

## La notation

Trois règles, tenues par l'API :

1. la notation n'est possible **qu'après livraison** — une commande non livrée est refusée
   en 400 ;
2. la note doit être un **entier de 1 à 5** ;
3. **une seule note par commande** — une seconde tentative est refusée en 400.

Un commentaire libre peut accompagner la note. L'avis remonte ensuite à la console
d'exploitation (`/reviews`) avec sa note, sa commande, son chauffeur et son marchand.

> Voir la [réserve sur la modération](10-console-exploitation.md#avis-clients-reviews) :
> les avis sont consultés et agrégés, mais il n'existe pas de geste de modération.

## Les notifications au client

Quatre événements de course déclenchent une notification au destinataire :

| Événement | Modèle FR | Modèle AR |
|---|---|---|
| `order.created` | Votre colis {code} est enregistré. | تم تسجيل طردكم {code}. |
| `order.out` | Votre colis {code} est en cours de livraison. | طردكم {code} في طريق التوصيل. |
| `order.delivered` | Votre colis {code} a été livré. Merci ! | تم تسليم طردكم {code}. شكراً! |
| `order.failed` | Échec de livraison du colis {code}. Nouvel essai prévu. | فشل تسليم الطرد {code}. ستتم إعادة المحاولة. |

Ces quatre modèles sont **transactionnels** : ils sont exemptés de l'obligation de
consentement de la Loi 09-08, contrairement aux envois marketing. Les modèles sont
éditables par l'organisation depuis `/templates`, et la variable `{code}` est réellement
substituée.

Les envois sont faits **après** l'écriture métier et ne sont jamais bloquants : une
notification qui échoue ne fait pas échouer une course.

> **Réserve.** Aucune passerelle réelle n'est branchée : les envois sont tracés au journal
> de notifications, ils n'atteignent pas un opérateur SMS ou WhatsApp.

## Ce que le PRD décrit et qui n'existe pas

Le PRD-04 décrit une expérience client plus riche. À ce jour, ne sont livrés que le suivi
par code et la notation. N'existent pas :

- le **suivi en direct** de la position du livreur sur une carte ;
- le **choix ou la confirmation d'un créneau** de livraison par le client ;
- la **messagerie client ↔ livreur** (le chat existe entre le livreur et le dispatch, pas
  avec le client) ;
- le **relais d'appel / SMS** masquant le numéro du client. La fiche contact de l'app
  livreur est une démonstration visuelle sans appel ni SMS, et elle le dit ; mais le
  numéro du destinataire fait bien partie de la charge utile que reçoit le livreur — la
  règle « numéro toujours masqué » tient à l'affichage, pas au contrat d'API.
- une **page web de suivi**. Le suivi vit dans l'application mobile ; la console n'expose
  pas de page publique équivalente.
