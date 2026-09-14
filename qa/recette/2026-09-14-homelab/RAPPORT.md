# Recette Transpo — rejeu intégral sur le homelab, 14 septembre 2026

**Environnement** : homelab K8s (`admin@homelab`, namespace `transpo`), console
`http://transpo.wedowonders.com`, API `http://transpo-api.wedowonders.com`, base remise à
zéro au début du run. Images `transpo-api` et `transpo-web` reconstruites et déroulées le
matin même.

**Commande** : `source qa/profil-homelab.sh && qa/rejouer-tout.sh --sans-mobile`

## Verdict

| Section | Cas | Verdict |
|---|---|---|
| A — plateforme & provisionnement | 29 | 29/29 |
| B — amorçage des comptes & authentification | 18 | 18/18 |
| C→F — paramètres, flotte, zones, commandes | 46 | 46/46 |
| H→T — consoles, terrain, finance, conformité | 58 | 58/58 |
| **Total web** | **151** | **151/151** |
| G — app livreur, sur émulateur Android | 21 | 21/21 |
| **Total** | **172** | **172/172, aucun échec** |

Les cas web sont joués en une seule passe continue depuis une base vierge (~30 minutes). La
section G se joue à part, sur l'émulateur : elle ne peut pas partager la machine avec les
cas web, et elle vise la même API déployée.

TC-B16 a été rejoué seul après le déploiement du correctif de sécurité qu'il met en cause
(voir plus bas) : 18/18 sur la section B complète.

## Ce que ce run a coûté avant de passer

Le premier lancement de la journée a rendu **69 échecs**. Aucun n'était un défaut du
produit : tous venaient du rejeu lui-même. C'est le constat principal de la journée.

| Défaut d'outillage | Cas emportés |
|---|---|
| `reset-test` supprime `rabatexpress` et `tangerlog` — le jeu de données §0.4 que toutes les sections supposent acquis — et aucun cas ne les recrée | 8 de A, 15 de B, les 46 de C→F |
| TC-B02 lançait le CLI `account` par un `kubectl exec` codé en dur, dont les arguments se perdaient hors du `sh -c` | B02 et sa cascade |
| Les mots de passe temporaires sont des base64url de 12 caractères ; le motif qui les relisait oubliait le souligné et en tronquait un sur quatre | A23, A24, A26 |
| `logout()` visait n'importe quel `[aria-haspopup="menu"]` — sur /users, le menu « … » de la première ligne | L07, Q05 |
| Le décor de la section G retirait au sort le mot de passe de l'administrateur, rendant la section B injouable après lui | B11 |

Le rejeu « depuis une base vierge » n'avait donc **jamais** été jouable : il ne tenait que
sur un `rabatexpress` laissé par une session antérieure. Une précondition que personne
n'exécute est une précondition qui n'existe pas.

Deux défauts de restitution, sans effet sur les verdicts mais sur ce qu'on peut en montrer :

- **Les preuves vidéo de trois sections sur quatre étaient détruites** à chaque run.
  Playwright vide son `outputDir` au démarrage et les quatre appels le partagent ; le
  script de rangement existait et n'était jamais appelé. Corrigé.
- Le journal s'accumulait d'un run à l'autre : le décompte final additionnait les passages
  de la journée. Le 14/09 au matin il a rendu les 69 échecs comme s'ils venaient du rejeu
  qui venait de passer au vert. Corrigé.

## Constats produit du jour

| # | Constat | Suite donnée |
|---|---|---|
| 1 | L'espace marchand n'affichait jamais l'enseigne au nom de laquelle le marchand agit — seulement la personne connectée. Le périmètre existait dans le jeton, la console ne savait pas le lire. | Corrigé et déployé (API, BFF, en-tête de `/portail`) |
| 2 | `/v1/driver/missions` renvoyait la ligne de commande entière, `drop_phone` compris, alors que l'écran de mission annonce au livreur « l'API ne fournit pas de numéro client ». Le numéro voyageait en clair jusqu'à l'appareil. | Corrigé et déployé ; vérifié sur l'API en ligne |
| 3 | **Trente mauvais mots de passe verrouillaient la plateforme entière.** Le comptage anti-bruteforce « par source » n'identifiait pas la source : derrière l'ingress, l'API retombait sur l'adresse d'un pod du cluster, la même pour tout le monde. Seuil de 30 sur 15 minutes, partagé par tous les utilisateurs. | Corrigé et déployé |
| 4 | L'argent encaissé APRÈS le dépôt du jour devenait indéclarable : un dépôt clôt la caisse, l'encaissement suivant en rouvre une à la même date, et les trois lectures prenaient l'une des deux au hasard. | Corrigé et déployé |
| 5 | `GET /v1/cash/sessions` ne triait que par livreur : la console de caisse montrait la caisse déjà déposée au-dessus de la caisse courante une fois sur deux. | Corrigé et déployé |
| 6 | **Le récap de caisse du livreur n'a jamais chargé la caisse.** `load()` lisait le cache des missions et l'historique, jamais `getMyCash()` : le bloc annonçait « aucun encaissement enregistré » quand le serveur en comptait 2 700 DH sur six courses. | Corrigé |
| 7 | L'écran de livraison réussie annonçait « Aucune autre mission en attente » et proposait pour seule action un bouton « Mission suivante ». | Corrigé |

**Le constat n° 3 est le plus sérieux de la journée.** Deux sondes l'établissent : en direct
sur l'API, un `x-forwarded-for` donne bien la clé `ip:198.51.100.7` ; à travers l'ingress, le
même appel donne `ip:10.244.1.68`. Trente échecs de connexion, venus de n'importe qui,
refusaient donc la connexion à TOUS les utilisateurs pour le reste de la fenêtre. Je l'ai
moi-même subi le matin même en enchaînant des cas à connexion refusée, et j'ai vidé la table
en prenant ça pour une nuisance d'outillage.

Le produit ne compte plus par source quand la source n'est pas identifiable : mieux vaut ne
pas compter que compter tout le monde ensemble. **Pour que le comptage par source fonctionne
réellement, l'ingress doit propager `X-Real-IP` ou `X-Forwarded-For` jusqu'à l'API — c'est
une configuration de cluster, laissée à arbitrage.**

Le constat n° 2 reste une question ouverte : le PRD prévoit un relais d'appel masquant le
numéro du client. Tant qu'il n'existe pas, la donnée ne sort plus — mais le livreur n'a
aucun moyen d'appeler son destinataire.

## Preuves

`qa/recette/2026-09-14-homelab/TC-XXX/` — une vidéo par cas doté d'un écran, plus les captures
de la section G. Neuf cas de la section H→T n'ont pas de vidéo : ils interrogent l'API sans
navigateur (TC-M04, TC-O01, TC-P03, TC-P04, TC-P06, TC-S02, TC-S03, TC-S04, TC-S06). Leur
preuve est la trace du journal.

Les enregistrements ne sont pas versionnés (147 Mo) : `journal.txt` et ce rapport le sont.
La page `/docs` de la console en dresse l'inventaire et dit, cas par cas, si la vidéo est
présente dans l'environnement consulté.
