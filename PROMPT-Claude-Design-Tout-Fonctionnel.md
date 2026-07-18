# Prompt Claude Design — Rendre TOUT le design fonctionnel

> À coller dans Claude Design, projet **« Transpo — Prompts Claude Design »**.
> Objectif : que **chaque** élément interactif marche comme dans une vraie application. Aucun bouton mort, aucun filtre décoratif, aucun écran-cible manquant.
> Conventions habituelles : `window.Transpo`, `Store` partagé, `STATUS`, `money()`, FR/AR, thème clair/sombre. Tu peux envoyer ce prompt en entier ou section par section (§).

## Règles générales (à appliquer partout)

1. **Brancher réellement, pas de façade.** Interdits : `onClick={() => {}}`, boutons sans handler, dictionnaires/états définis mais jamais utilisés. Chaque action doit produire un effet visible à l'écran.
2. **Réutilise et étends le `Store` partagé** (`lib.jsx`) — il gère déjà l'état réactif des commandes/livreurs (créer, assigner, faire progresser, encaisser, annuler). Pour les nouveaux domaines (tenants, cash, retours, fraude, hub, factures), ajoute des actions au `Store` (ou un store par domaine) sur le même modèle, pour que les changements de statut se reflètent partout.
3. **Filtres / recherche / pagination** doivent réellement filtrer/paginer les données (état + calcul), ou être retirés s'ils n'ont pas de sens. Pas de `defaultValue` figé qui simule un filtre.
4. **Exports / PDF / génération de fichier** : en maquette, un **toast de confirmation** (« Fichier généré », « Export lancé », « PDF téléchargé ») suffit — mais l'action doit se déclencher au clic, pas rester inerte.
5. **Navigations manquantes** : tout bouton qui désigne un écran existant doit y mener (`go(...)` / ouverture de dialog).
6. **Formulaires de création/édition** implicites mais absents : construis le dialog/écran correspondant, avec validation et effet sur la liste.
7. Après chaque écran, **vérifie toi-même** en cliquant : le handler existe-t-il et modifie-t-il l'UI ? (C'est l'erreur récurrente à éviter : ajouter du code jamais appelé.)

---

## §1 — Shell des consoles (`lib.jsx`, transverse à toutes les consoles)

- **Recherche globale du Topbar** (« Rechercher une commande, un marchand, un code… ») : rends-la fonctionnelle — état de saisie + résultats (filtrage des commandes du `Store` par réf/code/marchand, affichage d'une liste déroulante de résultats cliquables menant au détail). À défaut, un panneau de résultats simple.
- **Cloche de notifications** : au clic, ouvre le **Centre de notifications** (`notifcenter`, déjà construit au Lot 16) ; affiche un badge de non-lues.
- **Avatar / utilisateur** : ajoute un menu déroulant (Profil, Paramètres, **Se déconnecter** → retour à l'écran d'auth `lot15`).

## §2 — Console SaaS (`lot5.jsx`) — la plus lacunaire, tout est à rendre vivant

- **« Provisionner un tenant »** : construis un **dialog de création de tenant** (nom, ville, plan, statut initial) qui ajoute réellement une ligne à la liste `TENANTS` (via état/Store).
- Menu par tenant :
  - **« Voir la fiche »** → écran/volet de détail tenant (infos, consommation, historique).
  - **« Se connecter en tant que »** → action d'impersonation : toast + (option) bascule visuelle vers la Console transport du tenant.
  - **« Suspendre » / « Réactiver »** → change réellement le `status` du tenant dans la liste (couleur du badge incluse).
  - **« Déprovisionner »** → `AlertDialog` de confirmation puis retrait de la ligne.
- **Abonnements** : « Choisir » (un plan) → confirmation + mise à jour du plan courant ; « Historique » → volet/liste d'historique de facturation.
- **Facturation plateforme** : « Export comptable » et « Relancer les impayés » → toast ; téléchargement par ligne → toast « PDF téléchargé ».
- **Paywall** : CTA (Régler / Choisir un plan / Augmenter la limite) → toast ou navigation ; « Contacter le support » / « Se déconnecter » → action réelle.

## §3 — Portail marchand (`lot4.jsx`)

- **« Créer » (nouvelle commande)** : branche au `Store.createOrder(...)` (comme le Lot 1 admin) pour que la commande apparaisse réellement dans « Mes commandes ».
- **Recherche « Réf, code, client… »** et **filtre statut** : rends-les fonctionnels (filtrage réel de `M_ORDERS`).
- **« Page de suivi publique »** : ouvre le Suivi public (`lot5a`) pré-rempli avec le code de suivi de la commande.
- **« Recharger »** (portefeuille) : dialog de rechargement (montant + moyen : carte/virement/CMI) qui crédite réellement le solde + ligne dans l'historique des mouvements.
- **« PDF »** (facture) → toast. **« Régénérer »** (clé API) → régénère et affiche une nouvelle clé. **« Ajouter »** (webhook) → dialog d'ajout qui insère une ligne.
- **Cloche** (Topbar marchand) → centre de notifications marchand (ou toast si hors périmètre).

## §4 — Commandes / Dispatch / Zones (`lot1.jsx`, `lot2.jsx`)

- **Dashboard** : « Aujourd'hui ▾ » → sélecteur de date fonctionnel ; « Exporter » → toast ; « Tout voir » (urgentes) → va à la liste commandes filtrée ; « Ouvrir » (reversement) → va au Reversement COD (`payout`).
- **Liste commandes** : rends **Ville / Marchand / Livreur** filtrants (comme le filtre Statut qui marche déjà) ; **pagination** réelle (page suivante/précédente, numéros) ; bouton date fonctionnel.
- **Assistant création** : « Ajuster » position GPS → mini-sélecteur de point sur carte (ou champ lat/lng éditable).
- **Dispatch** : « Actualiser » → recharge l'état + toast ; « Filtres » → panneau de filtres ; boutons **zoom + / − / calques** → agir sur la carte Leaflet.
- **Suggestion** : « Affecter manuellement » → sélecteur manuel de livreur.
- **Zones** : « Dessiner un polygone » → mode dessin réel sur la carte (ajout de sommets au clic) ; selects **Région / Province / Commune** → filtrer/mettre à jour la zone ; « Enregistrer » → confirmation + persistance de l'état.

## §5 — Flotte & Facturation (`lot6.jsx`)

- **Chauffeurs** : « Modifier » (horaires) → édition réelle du planning hebdo.
- **Tarification** : « Palier » → ajoute un palier ; champs de grille (De/À/Tarif, fragile, programmée, TVA) → **éditables** et pris en compte par le simulateur ; « Exporter la grille » / « Enregistrer » → toast/persistance.
- **Facturation** : « Générer les factures » → crée des lignes ; « PDF » / « Envoyer » → toast + changement de statut (Brouillon→Envoyée) ; « Export comptable » → toast.
- **Notifications** : « Nouveau modèle » / « Éditer » → dialog d'édition de modèle (événement, canaux, langues).
- **Utilisateurs** : « Inviter » → dialog d'invitation qui ajoute un membre ; menu (changer rôle / réinitialiser MDP / désactiver) → actions réelles sur la ligne.
- **Paramètres entreprise** : champs éditables (état contrôlé) + « Enregistrer » → toast de sauvegarde.

## §6 — Autres consoles (Hub, Retours, Cash, Analytics, Fraude, PC flotte)

- **Tri en hub (`lot9`)** : « Enregistrer l'entrée » (scan) → déplace le colis en colonne « Scannés » ; « Marquer scanné » / « Placer sur quai » → déplacent réellement le colis entre colonnes ; select de hub → change le contenu affiché.
- **Retours (`lot10`)** : « Lancer le retour au marchand » → change le statut du retour (→ À rendre/Rendu) ; « Export » → toast.
- **Réconciliation cash (`lot8`)** : « Enregistrer le dépôt en agence » → passe la session à `DEPOSE` ; « Export comptable » → toast.
- **Analytics (`lot12`)** : « Export » → toast (les onglets et le sélecteur de période marchent déjà).
- **Fraude (`lot13`)** : « Ouvrir une enquête » / « Blanchir » → changent le statut du cas ; « Export enquêtes » → toast.
- **PC flotte (`lot14`)** : « Suivre » → centre/verrouille la carte sur le livreur ; « Contacter » → toast/appel simulé ; « Gérer les zones » → va à l'éditeur de zones (`zones`) ; boutons de zoom → agir sur la carte.
- **Reversement COD (`lot16`)** : « Export comptable » → toast.

## §7 — Mobiles (livreur `lot3`, client `lot11`)

- **Livreur — feuille contact** : boutons « Appeler » / « WhatsApp » / « SMS » → action réelle (toast d'appel simulé / ouverture de la messagerie).
- **Livreur — Mes documents** : « Téléverser un document » → simulateur d'upload qui ajoute une ligne « en vérification » ; téléchargement par doc → toast.
- **Livreur — Aide** : recherche FAQ → filtre réellement la liste des questions.
- **Client — suivi** : « Modifier le créneau » → mène à l'écran de choix de créneau ; boutons appel / WhatsApp → action réelle.

---

## Critère de réussite global

En parcourant chaque interface et en cliquant sur chaque bouton/filtre : **aucun élément ne doit rester sans effet.** Soit il modifie l'état affiché, soit il navigue, soit il ouvre un dialog, soit il déclenche un toast de confirmation. Les filtres et recherches doivent réellement filtrer. Aucun handler vide, aucun code défini mais jamais appelé.
