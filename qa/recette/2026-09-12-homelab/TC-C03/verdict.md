# TC-C03 — Régional

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Devise, fuseau horaire et langue par défaut réglables et persistants.

**Obtenu.** Conforme sur la langue : FR → العربية enregistrée, persistée après rechargement, base `MAD | Africa/Casablanca | ar`, puis FR restauré (`fr`). Devise et fuseau n'offrent qu'une option (MAD, Africa/Casablanca) : leur persistance n'est pas démontrable tant qu'aucune seconde valeur n'existe. La langue par défaut de l'organisation ne change pas la langue d'affichage de la console, pilotée par le cookie `lang` — comportement attendu, à confronter en section T.

**Preuve.** [`TC-C03.webm`](./TC-C03.webm)
