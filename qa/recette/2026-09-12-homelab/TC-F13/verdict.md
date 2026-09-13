# TC-F13 — Création par le marchand

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026  ·  *Passé après correctifs AN-23, AN-26, AN-27*

**Attendu.** Le rôle MERCHANT crée une commande depuis `/portail`, mais n'assigne ni ne fait progresser (actions absentes / 403).

**Obtenu.** Conforme de bout en bout.
- L'administrateur crée le compte marchand **depuis `/users`**, avec le nom du marchand rattaché.
- Le marchand se connecte, atterrit sur **Espace marchand**, et crée sa commande depuis **Nouvelle commande**.
- Les quatre actions d'exploitation tentées en direct répondent **403** : `assign`, `advance`, `cancel`, et l'accès à la console (`/v1/drivers`).
- Une commande déposée **au nom d'un autre marchand** (`Atlas Store`) est réattribuée à `Boutique Test` : l'identité vient du compte, pas du formulaire.

**Ce que le cas a révélé.** Trois trous en enfilade, tous fermés :
- **AN-23** — aucun écran ne permettait de créer un compte marchand. Le portail était livré **sans porte d'entrée** : le jeu de données §0.4 exigeait un accès shell à la production.
- **AN-26** — le portail marchand ne proposait **aucune création de commande**, alors que l'API l'autorisait et que c'est sa raison d'être. Un marchand devait téléphoner à son transporteur.
- **AN-27** — `POST /v1/orders` acceptait le champ `merchant` tel quel : un marchand pouvait déposer des courses **au nom d'un concurrent du même tenant**, et les voir apparaître dans la facturation de l'autre.

**Preuve.** [`TC-F13.webm`](./TC-F13.webm)
