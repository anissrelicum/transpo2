# Prompt Claude Design — 2 dernières corrections de cohérence

> À coller dans Claude Design, projet **« Transpo — Prompts Claude Design »**.
> Ce ne sont pas de nouveaux écrans mais des ajustements sur l'existant. Garde les conventions du projet (`window.Transpo`, `STATUS`, `money()`, thème clair/sombre, indigo/slate).

---

## Correction A — Bilingue FR/AR sur les consoles encore en français uniquement

Plusieurs interfaces sont déjà FR/AR avec RTL (app livreur, suivi public, commandes, dispatch, zones). Étends le même mécanisme aux écrans restés **en français uniquement** :

- **Console SaaS** (`lot5.jsx` — tenants, abonnements, facturation plateforme, paywall)
- **Flotte & facturation** (`lot6.jsx` — véhicules, chauffeurs, tarification, factures, notifications, utilisateurs, objectifs)
- **Analytics & SLA** (`lot12.jsx`)

Attendu :
- Ajoute un dictionnaire FR/AR par écran (comme le fait déjà `lot1.jsx` avec l'objet `L = { fr: {...}, ar: {...} }`), et bascule via le sélecteur de langue déjà présent dans le harnais (`lang` / `dir`).
- Applique le `dir="rtl"` en arabe (le `Shell` le gère déjà au niveau `Theme`), et vérifie l'inversion des marges/icônes directionnelles.
- Réutilise `STATUS_AR` et `CodChip(lang)` déjà exposés dans `window.Transpo` pour les statuts et badges COD.
- Traduis au minimum : titres de page, en-têtes de colonnes de tableaux, libellés de filtres et de boutons, statuts. Les données de démo (noms, villes) peuvent rester telles quelles.

Objectif : plus aucune console majeure figée en FR quand l'utilisateur bascule en AR.

## Correction B — Clarifier les deux modes de facturation marchand

Le marchand a aujourd'hui **deux mécanismes de paiement** qui coexistent sans être reliés :
1. un **portefeuille prépayé** (`lot4.jsx` écran Portefeuille — chaque livraison débite le solde) ;
2. des **factures mensuelles post-payées** (`lot4.jsx` écran Factures + `lot6.jsx` Facturation côté admin).

Clarifie le rapport entre les deux :
- Ajoute, sur le Portefeuille marchand, une **bascule ou un indicateur du mode de facturation du compte** : « Prépayé (portefeuille) » vs « Post-payé (facturation mensuelle) », avec une explication courte de ce qui s'applique.
- Si le compte est en post-payé, le solde de portefeuille doit indiquer clairement qu'il n'est pas débité à chaque commande (les livraisons sont cumulées sur la facture mensuelle).
- Côté admin (`lot6.jsx` Paramètres entreprise ou fiche marchand), expose le **choix du mode de facturation par marchand** (prépayé / post-payé), cohérent avec la commission plateforme déjà paramétrable.

Objectif : qu'un lecteur comprenne, sans ambiguïté, quel flux d'argent s'applique à un marchand donné.
