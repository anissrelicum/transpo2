# TC-C02 — Commission & TVA

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Commission plateforme et TVA réglables et persistantes ; ces taux alimentent la facture marchand (TC-N03).

**Obtenu.** Conforme. Commission 15 → 18 % enregistrée (« Enregistré ✓ »), persistée après rechargement, base à `0.18 | 0.2` ; restauration à 15 % vérifiée de la même façon (`0.15 | 0.2`). Le run repart donc sur les valeurs de référence 15 % / 20 % attendues par les sections M et N.

**Preuve.** [`TC-C02.webm`](./TC-C02.webm)
