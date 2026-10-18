# ADR 0005 — La société se déduit de l'adresse e-mail à la connexion

Date : 2026-10-18 · Statut : accepté

## Contexte
L'app livreur demandait la « société » (slug du tenant) avant l'e-mail, et la console se
rabattait sur une société par défaut faute de sous-domaine. Un utilisateur ne connaît pas
le slug de son entreprise ; un administrateur d'une autre société ne pouvait pas se
connecter sur l'adresse générique de la console.

## Décision
`POST /v1/auth/login` sans `x-tenant-slug` retrouve la société par l'adresse e-mail
(insensible à la casse), dans les schémas des sociétés non suspendues, en une requête.
La réponse renvoie `tenant`. L'en-tête reste accepté (sous-domaine, `?org=`, outils).

- Aucun compte : même refus 401 qu'un mauvais mot de passe (pas d'énumération).
- Un compte dans plusieurs sociétés (livreur partagé) : seules celles où le mot de passe
  est bon sont retenues ; s'il en reste plusieurs, 409 avec la liste `societes` à choisir —
  jamais avant un mot de passe vérifié.
- Anti-bruteforce : compteur `u:*:<email>` en plus du compteur par IP.

## Conséquences
L'app livreur et la console n'ont plus de champ « société ». La recherche parcourt les
schémas des sociétés à chaque connexion sans société : suffisant à l'échelle actuelle
(dizaines à centaines de sociétés) ; au-delà, un annuaire `platform` (e-mail → société)
tenu à jour à la création des comptes prendra le relais.
