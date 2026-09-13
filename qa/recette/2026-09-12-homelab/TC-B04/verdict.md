# TC-B04 — Anti-bruteforce

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** 5 refus « Identifiants invalides » puis 429 « Trop de tentatives »

**Obtenu.** Exactement 5 refus puis le 429 attendu. **OBS-02 confirmée** : compteur en mémoire de processus, keyé (tenant, email) — aucun comptage par IP

**Preuve.** [`TC-B04.webm`](./TC-B04.webm)
