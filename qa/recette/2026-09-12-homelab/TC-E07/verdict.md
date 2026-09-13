# TC-E07 — Polygone à moins de trois sommets

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté — clôt AN-20*

**Attendu.** Deux sommets enregistrés → refus ; le tracé enregistré ne bouge pas.

**Obtenu.** `PATCH` → **400 « Un polygone demande au moins trois sommets. »** ; la base conserve ses 4 sommets et la carte son tracé. La forme des sommets est contrôlée en même temps (`[latitude, longitude]` numériques).

**Ce que le cas a révélé au premier passage.** Un polygone à deux sommets était **accepté**. La zone disparaissait alors de la carte — le rendu exige trois points — tout en restant listée : un découpage qui ne délimite rien, et un géofencing muet sans le moindre avertissement.

**Preuve.** [`TC-E07.webm`](./TC-E07.webm)
