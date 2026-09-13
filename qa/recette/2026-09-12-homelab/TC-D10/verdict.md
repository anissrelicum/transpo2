# TC-D10 — Disponibilité

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Bascule de disponibilité de `Sara Bennis` (accessible aussi au dispatcher), persistée ; un chauffeur indisponible ne doit plus être proposé par le dispatch (vérifié en TC-F03).

**Obtenu.** Conforme. L'administrateur la passe indisponible : bascule persistée après rechargement, effectif « 2 chauffeurs · 1 disponibles ». Le **dispatcher** trouve la bascule active (non grisée) et la manœuvre dans les deux sens — l'action lui est bien ouverte, contrairement au reste de la fiche chauffeur réservé à l'admin. Le cas laisse Sara **indisponible**, état attendu par TC-F03.

**Preuve.** [`TC-D10.webm`](./TC-D10.webm)
