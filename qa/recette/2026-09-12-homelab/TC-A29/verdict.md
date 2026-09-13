# TC-A29 — Créer / réinitialiser l'administrateur d'une organisation existante

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté après correctif — clôt AN-11*

**Attendu.** Depuis `/saas`, créer ou réinitialiser l'administrateur d'une organisation déjà provisionnée : mot de passe temporaire affiché une seule fois, connexion aboutie, action tracée.

**Obtenu.** Conforme sur les deux volets, joués sur `tangerlog` (pour ne pas invalider le `Test1234` du §0.4).
- Adresse **inconnue** → administrateur créé, mot de passe affiché une fois et non réaffiché après rechargement ; la connexion aboutit avec le rôle **Administrateur**.
- Adresse **déjà administratrice** → compte réinitialisé, **non dupliqué** (1 seule ligne en base) ; l'ancien mot de passe est refusé, le nouveau accepté.
- Journal d'audit : `tenant.admin.create` puis `tenant.admin.reset`.
- Non-régression AN-13 mesurée à chaque passage : `pointerEvents=auto · scrollLocked=false · ariaHiddenRacine=false · menusOuverts=0`.

Une organisation orpheline d'administrateur se récupère désormais **depuis la console**, sans accès shell à la production.

**Preuve.** [`TC-A29.webm`](./TC-A29.webm)
