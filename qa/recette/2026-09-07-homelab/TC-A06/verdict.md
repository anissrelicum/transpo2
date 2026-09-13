# TC-A06 — Provisionner l'organisation 2 (isolation)

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A06)
- Provisionner `tangerlog` / `Tanger Logistique` / `Tanger` / `TPE Coursier`.
- 2 organisations listées.

## Obtenu
- Dialogue rempli (plan TPE Coursier, admin Karim Bennis `admin@tangerlog.ma`) — capture 01.
- Mot de passe temporaire de l'admin affiché une seule fois (`TfVXbSzfYS7H`, consigné dans
  `COMPTES.md`) — capture 02.
- **2 organisations listées** : Tanger Logistique (`tangerlog · Tanger`, TPE Coursier, 299 DH/mois,
  Essai 14 j) et Rabat Express (`rabatexpress · Rabat`, Transporteur, 899 DH/mois, Essai 14 j) ;
  compteurs « 2 tenants · 0 actifs · 2 en essai » — capture 03.
- Schéma `tenant_tangerlog` créé côté base (vérifié via psql).

## Captures
- `01-dialogue-provisioning-tangerlog.png`
- `02-mot-de-passe-admin-tangerlog.png`
- `03-deux-organisations-listees.png`

## Anomalies
Aucune.
