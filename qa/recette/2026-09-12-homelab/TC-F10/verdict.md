# TC-F10 — Pagination

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026

**Attendu.** Pagination réelle, page courante mise en évidence, bornes désactivées aux extrémités.

**Obtenu.** Conforme sur 20 commandes / 3 pages (8 par page). Page 1 : chevron gauche désactivé, 8 lignes. Le chevron droit change réellement de contenu. Le numéro de dernière page désactive le chevron droit, et le retour en page 1 restitue exactement la première ligne d'origine.

**Preuve.** [`TC-F10.webm`](./TC-F10.webm)
