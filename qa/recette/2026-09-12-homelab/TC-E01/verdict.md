# TC-E01 — Créer une zone

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Passé après correctif AN-17*

**Attendu.** `/zones` → Nouvelle zone → noms FR/AR, couleur indigo → Dessiner un polygone → 4 sommets → Enregistrer : zone listée et tracée.

**Obtenu.** Conforme. `Rabat Centre` / `الرباط الوسط`, couleur indigo, **4 sommets exactement** en base, une seule forme rendue sur la carte.

**Ce que le cas a révélé au premier passage.** Le polygone enregistré comptait **8 sommets** : l'entrée en mode tracé **ajoutait** aux sommets existants — le carré par défaut posé à la création de la zone — au lieu de repartir d'une forme neuve. Le résultat était un polygone incohérent, à cheval sur Casablanca et Rabat, sans le moindre signal. **→ AN-17, corrigée.**

**Preuve.** [`TC-E01.webm`](./TC-E01.webm)
