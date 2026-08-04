# Maquette de référence — source unique du design

Fichiers extraits du projet Claude Design **« Transpo — Prompts Claude Design »**
(`7671dfdf-e802-4730-96ab-65f0e37e1a87`). Ils font **foi** sur l'apparence :
en cas de désaccord entre le code et ces fichiers, c'est le code qui a tort.

| Fichier | Contenu |
|---|---|
| `lot3-app-livreur.jsx` | App mobile livreur — 38 composants, 22 écrans, cadre 390×844 |
| `lib-design-system.jsx` | Bibliothèque partagée : thème, `StatusBadge`, `CodChip`, `money`, primitives |

## Ce qu'il faut en retenir

Les maquettes sont écrites en **React + Radix Themes** avec des variables CSS
(`var(--indigo-9)`). L'app mobile est en **React Native pur** : les variables CSS
n'y existent pas. La transposition passe par `@transpo/design-tokens`, qui est la
source unique web ↔ RN — **ne jamais coder une couleur en dur dans un écran**.

Constantes structurantes de l'app livreur :

- Cadre **390 × 844**
- Barre d'onglets basse : **64 px**, 5 onglets (Missions, Tournée, Scanner, Shift, Profil),
  actif `indigo-11`, inactif `gray-9`, icône 20 px + label
- Onglets **masqués** sur les écrans de flux (connexion, détail, statut, preuve, COD, échec)
  où un retour `←` les remplace
- Action principale : **pleine largeur, 52 px**, collée en bas, sur un dégradé de fond
- Cibles tactiles **≥ 44 px**
- Thème **clair et sombre**
- **Bilingue FR/AR avec RTL complet** — les libellés arabes sont déjà dans la maquette,
  les reprendre plutôt que de retraduire
