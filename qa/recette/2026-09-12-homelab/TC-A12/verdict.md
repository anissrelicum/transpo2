# TC-A12 — Cloisonnement du realm plateforme

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Un super-admin n'entre pas dans un tenant

**Obtenu.** /dashboard et /orders redirigent vers /login ; la session /saas reste intacte

**Preuve.** [`TC-A12.webm`](./TC-A12.webm)
