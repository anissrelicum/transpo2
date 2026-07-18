# PRD — Transpo · Client final

Retour à [PRD-00-Vue-Ensemble.md](PRD-00-Vue-Ensemble.md). Modèle de données et règles transverses : voir ce document, § 4 et § 5.

**Source analysée** : `transpo/lot5.jsx` (section suivi public) et `transpo/lot11.jsx` (app client complète). Les deux coexistent : le **suivi public** est l'entrée minimale sans compte ; l'**app client** est une expérience mobile plus riche (créneau, notation) supposant une installation ou un lien approfondi.

> **Interactivité** : fonctionnel (voir [PRD-00](PRD-00-Vue-Ensemble.md) §9). Les boutons d'appel / WhatsApp déclenchent une action (toast) ; « Modifier le créneau » mène réellement à l'écran de choix de créneau ; le chat et la notation sont opérationnels.

---

## 1. Suivi public sans compte (`Transpo - Lot 5a Suivi Public`)

Cible : n'importe quel destinataire final, sans création de compte, mobile-first, **FR/AR avec bascule RTL complète**.

### 1.1 Saisie du code
Écran d'accueil épuré : champ de saisie à 8 caractères (majuscules, alphanumérique forcé), indicateur visuel de progression de saisie (8 pastilles), bouton **Suivre** désactivé tant que 8 caractères ne sont pas saisis. Raccourci « Exemple » pour préremplir en démo. Aide : *« Vous n'avez pas de code ? Contactez votre marchand »* — le client final n'a **aucune** interaction directe avec Transpo pour obtenir ce code, il vient toujours du marchand.

### 1.2 Page de résultat
En-tête plein contraste (fond indigo) avec statut courant en grand + ETA + niveau de confiance (« élevée »/etc.). Carte de suivi (position livreur + destination, non interactive). Timeline complète des 6 étapes du cycle de vie, traduite en FR ou AR selon la langue. Bloc colis **non sensible** (taille/fragilité, ville d'origine, ville de destination — jamais l'adresse complète ni le nom du destinataire). Montant à régler à la livraison si COD. Mention explicite de confidentialité : *« Aucune donnée personnelle sensible n'est affichée »*.

**Règle de confidentialité stricte** : le suivi public n'expose que statut, ETA, ville (pas l'adresse précise), et montant COD — jamais de nom, téléphone, ou adresse exacte, contrairement aux vues admin/marchand qui ont accès au détail complet.

## 2. App client (`Transpo - App Client Final`, 3 écrans mobiles)

Trois écrans présentés côte à côte dans le harnais de démo (pas nécessairement un flux linéaire unique) :

### 2.1 Suivi en temps réel
Carte avec trajet (retrait → position livreur → destination) et bandeau code de suivi. Feuille de statut : ETA en gros (« Dans ~12 min »), confiance élevée. **Carte livreur** avec avatar, nom, note (★), boutons contact directs (appel masqué, WhatsApp). Timeline courte (récupéré → en route → livraison). Callout montant à régler en espèces. Actions : **Modifier le créneau**, action de simulation (outil de démo).

### 2.2 Choix de créneau (`SlotScreen`)
Sélecteur de jour (4 jours à venir) + grille de créneaux de 2h (9h-21h), certains marqués **complets** (non sélectionnables). Confirmation avec récap jour+créneau choisi. Note : *« Le livreur vous appellera ~15 min avant son arrivée »*.

### 2.3 Messagerie / chat (`ChatScreen`) — ajouté
Écran de chat entre le client final et le livreur (ou le support), comblant le manque précédent (le client n'avait que le bouton « appeler »). En-tête avec avatar livreur + indicateur de présence « en ligne », fil de messages (bulles gauche/droite, horodatage, nom de l'émetteur côté livreur), **réponses rapides** pré-rédigées (« Je suis absent, laissez chez le gardien », « Appelez-moi en arrivant », « Combien de temps encore ? », « Changer l'adresse »), champ de saisie + envoi (Entrée). Cohérent avec le chat dispatch du livreur ([PRD-Lot3](PRD-Lot3-App-Livreur.md) §5.19).

### 2.4 Notation post-livraison (`RateScreen`)
Confirmation de livraison (horodatage + nom du livreur) → notation étoiles (1-5, avec libellé qualitatif dynamique : Très déçu/Moyen/Correct/Bien/Excellent) → tags rapides sélectionnables (Ponctuel, Aimable, Colis en bon état, Bonne communication, Rapide) → commentaire libre optionnel. Bouton **Passer** toujours disponible (la notation n'est jamais obligatoire).

## 3. Règles métier spécifiques au client final

1. **Zéro friction d'authentification** — que ce soit le suivi public ou l'app client, aucun des flux ne montre d'écran de connexion ; l'identité du client est implicite au code de suivi qu'il détient.
2. La **note du livreur** alimentée ici est la même donnée que celle affichée côté admin dans Analytics (§ Par livreur, colonne Note) et dans le profil livreur (badge ★) — synchronisation obligatoire, pas de duplication.
3. Le **choix de créneau** — ✅ *résolu dans la maquette* : la confirmation affiche désormais explicitement « Tournée replanifiée · votre arrêt a été repositionné dans la tournée du livreur · Nouvelle ETA transmise au dispatch » + SMS de rappel la veille. Reste à confirmer côté implémentation que cette replanification déclenche bien un recalcul réel de la tournée ([PRD-01](PRD-01-Console-Admin-Dispatcher.md) §5 Tournées) et n'est pas qu'un message.
4. Cohérence à vérifier entre le **Suivi public** (FR/AR, sans compte, épuré) et l'**App client** (semble mono-langue FR dans la maquette, plus riche) — clarifier si ce sont deux produits distincts (l'un pour prospects/tiers sans app, l'autre pour clients ayant installé l'app) ou une seule expérience à unifier.
