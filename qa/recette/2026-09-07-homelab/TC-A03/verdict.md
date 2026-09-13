# TC-A03 — Provisionner l'organisation 1

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A03)
- `/saas` → **Provisionner** → Slug `rabatexpress`, Nom `Rabat Express`, Ville `Rabat`, Plan `Transporteur` → **Provisionner**.
- La ligne apparaît (statut **Essai** par défaut), schéma créé côté base.

## Obtenu
- Dialogue de provisioning rempli (slug, nom, ville Rabat, plan Transporteur, admin Nadia Alaoui
  `admin@rabatexpress.ma`) — capture 01.
- Provisioning réussi : dialogue **« Compte administrateur créé »** avec le mot de passe temporaire
  affiché une seule fois (`xtVg9YmEIgMz`, consigné dans `COMPTES.md` pour la section B) — capture 02.
- Ligne présente : **Rabat Express** / `rabatexpress · Rabat`, plan **Transporteur**, tarif
  899 DH/mois, abonnement **Essai — 14 j restants**, créée le 07/09/2026 ; compteurs
  « 1 tenants · 0 actifs · 1 en essai » — capture 03.
- Base : schéma `tenant_rabatexpress` créé, ligne `platform.tenants` présente (vérifié via psql).

## Captures
- `01-dialogue-provisioning-rempli.png`
- `02-mot-de-passe-admin-revele.png`
- `03-ligne-rabatexpress-essai.png`

## Anomalies
Aucune. (À noter : le dialogue crée désormais le 1er compte admin avec mot de passe temporaire —
l'anomalie AN-01 du plan semble corrigée côté produit, à confirmer en section B.)
