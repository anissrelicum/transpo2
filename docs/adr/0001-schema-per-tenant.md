# ADR 0001 — Isolation multi-tenant en schema-per-tenant

- **Statut** : accepté
- **Date** : 2026-07
- **Contexte** : Transpo est vendu en marque blanche à plusieurs transporteurs (tenants). Chaque tenant doit avoir ses données strictement isolées (commandes, livreurs, cash…). Un « workspace » créé côté Console SaaS = un tenant.

## Décision
Un **schéma PostgreSQL par tenant** (`tenant_<slug>`), plus un schéma **`platform`** pour les données globales (tenants, plans, factures plateforme, comptes super-admin).

- **Provisioning** d'un tenant = créer le schéma + appliquer les migrations métier dessus + insérer une ligne dans `platform.tenants` (cf. `infra/postgres/init.sql`, fonction `platform.provision_tenant`).
- **Résolution par requête** : le tenant est dérivé **du serveur** (sous-domaine ou claim JWT), jamais d'un paramètre client ; un middleware exécute `SET search_path TO tenant_<x>, platform` avant traitement.
- **Migrations** : appliquées sur `platform` puis itérées sur tous les schémas de tenants.

## Conséquences
- ✅ Isolation forte et simple à raisonner ; un tenant ne peut pas lire un autre schéma.
- ✅ Sauvegarde/restauration/суppression par tenant faciles.
- ⚠️ Les migrations doivent boucler sur N schémas (prévoir `db:migrate:tenants`).
- ⚠️ Très grand nombre de tenants (> plusieurs milliers) : surveiller le coût des connexions/`search_path` ; envisager pooling par tenant.

## Alternatives écartées
- **Discriminator column (`tenant_id`)** partagé : plus risqué (fuite si un `WHERE` est oublié), rejeté pour un domaine sensible (cash/COD).
- **Base par tenant** : isolation maximale mais lourd à opérer à ce stade.
