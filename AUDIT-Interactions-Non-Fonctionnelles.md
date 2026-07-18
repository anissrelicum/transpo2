# Audit — Interactions non fonctionnelles (passage maquette → vraie appli)

> ## ✅ RÉSOLU (vérifié après implémentation)
> **La totalité des points de cet audit a été corrigée par Claude Design et re-vérifiée dans le code.** Un **système de toasts partagé** a été ajouté au `Store` (`lib.jsx` : `Store.toast` + `ToastHost` + `window.Transpo.toast`) et sert de socle aux confirmations (exports, PDF, actions). Résumé des corrections vérifiées :
> - **Shell** : recherche globale filtre les commandes (résultats cliquables) ; cloche → centre de notifications (+ badge non-lues) ; menu avatar (Profil/Paramètres/Déconnexion).
> - **Console SaaS** : « Provisionner un tenant » = formulaire réel qui crée le tenant ; Suspendre/Réactiver/Déprovisionner (avec confirmation) ; fiche tenant ; plans ; exports → toast.
> - **Commandes** : filtres Ville/Marchand/Livreur **réels** + **pagination** à état ; navigations dashboard branchées ; exports → toast.
> - **Dispatch/Zones** : Actualiser, Filtres (popover), zoom carte (`onReady`+mapRef), dessin de zone, Enregistrer ; + panneau **replanifications client**.
> - **Marchand** : « Créer » branché au `Store` ; recherche/filtre réels ; recharge ; régénération de clé ; « Page de suivi publique ».
> - **Flotte/Facturation** : générer factures, inviter, éditer modèle, menu utilisateur, exports — tous branchés.
> - **Hub / Retours / Cash / Fraude** : scan déplace le colis, « Placer sur quai », « Lancer le retour », « Enregistrer le dépôt », « Ouvrir enquête »/« Blanchir » changent réellement les statuts.
> - **PC flotte** : zoom carte réel, Suivre/recentrer, « Gérer les zones » → éditeur de zones.
> - **Mobiles** : contacts → toast/actions, « Modifier le créneau » → écran de créneau.
>
> Le contenu ci-dessous est l'audit d'origine, **conservé pour historique**.

---

Objectif : recenser tout élément visible qui **ne réagit pas** au clic ou **n'agit pas réellement**, pour rendre l'ensemble du design opérationnel. Analyse du code source (`transpo/lot1…16.jsx`, `lib.jsx`, `home.jsx`).

## Légende des types

- **A — No-op (interaction manquante)** : le bouton/contrôle existe mais n'a aucun handler ; le concept existe déjà ailleurs, il suffit de le brancher. Effort faible.
- **B — Fonction inexistante** : le contrôle implique un écran/flux/traitement **jamais construit** (formulaire, export, page cible…). Effort réel (créer la cible).
- **C — Faux contrôle** : filtre / recherche / pagination / champ qui s'affiche mais **ne calcule rien** (valeur figée, pas d'état). Donne l'illusion de marcher.

> Ce qui **marche déjà** n'est pas listé : moteur de simulation partagé (`Store` : créer/assigner/faire progresser/encaisser/annuler une commande), assistants de création (Lot 1), éditeur de zones (ajout/retrait livreur), réconciliation cash (sélection/résolution), tournée (réordonnancement/optimisation), scanner mobile, flux livreur (statut/preuve/COD/caisse/onboarding), flux client (chat/créneau/notation), auth (login→2FA→SSO), i18n FR/AR, thèmes clair/sombre.

---

## 0. Transverse — Shell des consoles (`lib.jsx`) → impacte TOUTES les consoles

| Élément | Type | Ce qui manque |
|---|---|---|
| Barre de recherche globale du Topbar (« Rechercher une commande, un marchand, un code… » + ⌘K) | **C** | Aucun `onChange`, aucun résultat. Présente sur chaque écran console — c'est la fausse fonction la plus visible. |
| Cloche de notifications du Topbar | **A** | Aucun `onClick`. Devrait ouvrir le **Centre de notifications** (`notifcenter`) qui existe pourtant déjà (Lot 16). |
| Avatar / nom utilisateur (Topbar) | **B** | Pas de menu (profil, déconnexion, changer de compte). |

---

## 1. Console SaaS (`lot5.jsx`) — la plus lacunaire

| Élément | Écran | Type | Ce qui manque |
|---|---|---|---|
| **« Provisionner un tenant »** *(ton exemple)* | Locataires | **B** | Aucun `onClick` **et** aucun formulaire/assistant de création de tenant n'existe. |
| « Voir la fiche » | menu tenant | **B** | Pas d'écran de fiche tenant. |
| « Se connecter en tant que » (impersonation) | menu tenant | **B** | Aucune action ni flux. |
| « Suspendre » / « Réactiver » | menu tenant | **A** | Pas de handler ; le statut du tenant devrait changer (donnée déjà là). |
| « Déprovisionner » | menu tenant | **B** | Pas de handler ni confirmation. |
| « Choisir » (un plan) | Abonnements | **B** | Aucun flux de changement de plan. |
| « Historique » | Abonnements | **B** | Pas d'écran d'historique. |
| « Export comptable » / « Relancer les impayés » | Facturation | **B** | Aucune action. |
| Téléchargement par ligne de facture | Facturation | **B** | Pas de PDF/action. |
| CTA paywall (Régler / Choisir un plan / Augmenter la limite) | Paiement requis | **B** | Aucun flux de paiement/upgrade. |
| « Contacter le support » / « Se déconnecter » | Paywall | **A** | Liens sans action. |

**Constat** : la Console SaaS est quasi entièrement **statique** — presque tous les boutons d'action sont des type B (aucune cible construite).

---

## 2. Portail marchand (`lot4.jsx`)

| Élément | Écran | Type | Ce qui manque |
|---|---|---|---|
| Création de commande « Créer » | Nouvelle commande | **A/B** | Navigue vers `orders` mais **ne crée rien** (pas branché au `Store`, contrairement au Lot 1 admin qui, lui, crée réellement). |
| Recherche « Réf, code, client… » | Mes commandes | **C** | Décorative, pas de filtrage. |
| Filtre statut | Mes commandes | **C** | `defaultValue`, ne filtre pas. |
| « Page de suivi publique » | Détail commande | **A** | `onClick={() => {}}` explicite (no-op). Devrait ouvrir le Suivi public (`lot5a`) avec le code. |
| « Recharger » (montant) | Portefeuille | **A/B** | Le bouton n'a pas de handler ; aucun flux de paiement (CMI/carte/virement). |
| « PDF » | Mes factures | **B** | Pas de génération/téléchargement. |
| « Régénérer » (clé API) | API | **A/B** | Pas de handler ni de régénération réelle. |
| « Ajouter » (webhook) | API | **B** | Pas de formulaire d'ajout de webhook. |
| Cloche (Topbar marchand) | tous | **A** | Pas de handler. |

---

## 3. Commandes / Dispatch (`lot1.jsx`, `lot2.jsx`)

| Élément | Écran | Type | Ce qui manque |
|---|---|---|---|
| « Aujourd'hui ▾ » / « Exporter » | Dashboard | **B** | Sélecteur de date et export inexistants. |
| « Tout voir » (urgentes) | Dashboard | **A** | Devrait filtrer la liste commandes. |
| « Ouvrir » (reversement marchands) | Dashboard | **A** | Devrait mener au reversement COD (`payout`, existe désormais Lot 16). |
| Filtres Ville / Marchand / Livreur | Liste commandes | **C** | `defaultValue`, ne filtrent pas (seuls la recherche texte et le filtre Statut marchent). |
| Bouton date « 12/07/2026 » | Liste commandes | **C** | Décoratif. |
| Pagination (1 · 2 · 3 · 15 · ‹ ›) | Liste commandes | **C** | Aucun paging réel. |
| « Ajuster » position GPS | Assistant création | **B** | Pas de sélecteur de carte. |
| « Actualiser » / « Filtres » | Dispatch | **A/B** | Aucune action. |
| Zoom + / − / calques (carte) | Dispatch, PC flotte | **A** | IconButtons décoratifs (la carte Leaflet a son propre zoom, ces boutons ne sont pas branchés). |
| « Affecter manuellement » | Suggestion | **B** | Pas de sélecteur manuel. |
| « Dessiner un polygone » | Zones | **B** | Pas de dessin réel sur la carte (les zones sont pré-définies). |
| Selects Région / Province / Commune | Zones | **C** | `defaultValue`, sans effet. |
| « Enregistrer » (zone) | Zones | **A** | Pas de handler (l'état est déjà muté en direct, mais le bouton ne confirme rien). |

---

## 4. Flotte & Facturation (`lot6.jsx`)

| Élément | Écran | Type | Ce qui manque |
|---|---|---|---|
| « Modifier » (horaires chauffeur) | Chauffeurs | **A/B** | Pas d'édition. |
| « Palier » (ajouter) | Tarification | **B** | Pas d'ajout de palier. |
| Champs grille (De/À/Tarif, fragile, programmée, TVA) | Tarification | **C** | `defaultValue`, non éditables en pratique (le simulateur, lui, marche). |
| « Exporter la grille » / « Enregistrer » | Tarification | **A/B** | Aucune action. |
| « Générer les factures » / « Export comptable » | Facturation | **B** | Aucune génération. |
| « PDF » / « Envoyer » (facture) | Facturation | **B** | Aucune action. |
| « Nouveau modèle » / « Éditer » | Notifications | **B** | Pas d'éditeur de modèle. |
| « Inviter » (utilisateur) | Utilisateurs | **B** | Pas de formulaire d'invitation. |
| Menu utilisateur (changer rôle / reset MDP / désactiver) | Utilisateurs | **A/B** | Aucun handler. |
| Champs identité entreprise + « Enregistrer » | Paramètres | **C/A** | Champs `defaultValue`, bouton sans handler. |

*(Véhicules, Chauffeurs ajout/état, Objectifs & primes, simulateur de tarif : ✅ fonctionnels.)*

---

## 5. Autres consoles (Hub, Retours, Cash, Analytics, Fraude, PC flotte)

| Élément | Écran (fichier) | Type | Ce qui manque |
|---|---|---|---|
| « Enregistrer l'entrée » (scan hub) | Tri en hub (`lot9`) | **A** | Le champ scan marche mais le bouton ne valide rien. |
| « Marquer scanné » / « Placer sur quai » | Tri en hub (`lot9`) | **A** | Ne déplacent pas le colis entre colonnes. |
| Select de hub | Tri en hub (`lot9`) | **C** | `defaultValue`. |
| « Lancer le retour au marchand » | Retours (`lot10`) | **A** | Pas de handler (le reschedule et la mise en souffrance, eux, marchent). |
| « Export » | Retours (`lot10`) | **B** | — |
| « Enregistrer le dépôt en agence » | Réconciliation cash (`lot8`) | **A** | Session `A_DEPOSER` : bouton sans handler. |
| « Export comptable » | Cash (`lot8`), Analytics (`lot12`) | **B** | — |
| « Export » (Analytics) | Analytics (`lot12`) | **B** | — |
| « Ouvrir une enquête » / « Blanchir » | Fraude (`lot13`) | **A** | Pas de changement de statut du cas (le « Confirmer la fraude » via dialog, lui, marche). |
| « Export enquêtes » | Fraude (`lot13`) | **B** | — |
| « Suivre » / « Contacter » (livreur) | PC flotte (`lot14`) | **A/B** | Aucune action. |
| « Gérer les zones » | PC flotte (`lot14`) | **B** | Devrait mener à l'éditeur de zones (`zones`). |
| « Export comptable » | Reversement COD (`lot16`) | **B** | — |

*(Kanban hub visuel, sélection/résolution cash, tournée, tabs analytics, sélection de cas fraude, carte temps réel + plein écran PC flotte : ✅ fonctionnels.)*

---

## 6. Mobiles (livreur `lot3`, client `lot11`) — surtout des détails

| Élément | Écran | Type | Ce qui manque |
|---|---|---|---|
| « Appeler » / « WhatsApp » / « SMS » (feuille contact) | Livreur — détail mission | **A** | Boutons `ContactBtn` sans handler (l'ouverture de la feuille et les messages rapides marchent). |
| « Téléverser un document » / téléchargement | Livreur — Mes documents | **B** | Pas d'upload. |
| Recherche FAQ | Livreur — Aide | **C** | Pas de filtrage. |
| « Modifier le créneau » | Client — suivi | **A** | Ne mène pas à l'écran de créneau (écrans en vitrine séparée ; à relier). |
| Boutons appel / WhatsApp (livreur) | Client — suivi | **A** | Décoratifs. |

---

## 7. Récapitulatif priorisé

**P0 — le plus visible / structurant :**
1. **Console SaaS** entièrement à rendre vivante (provisioning tenant, fiche, suspendre/réactiver, plans, exports) — c'est l'interface la plus statique. Ton exemple « Provisionner un tenant » est ici.
2. **Recherche globale + cloche** du Shell (transverse à toutes les consoles).
3. **Création de commande marchand** qui ne crée rien (brancher au `Store` comme le Lot 1).

**P1 — no-op à brancher (concept déjà là, effort faible) :**
- Actions de statut sans handler : Suspendre/Réactiver tenant, « Enregistrer le dépôt », « Lancer le retour », « Ouvrir enquête / Blanchir », « Marquer scanné / Placer sur quai », menu utilisateurs.
- Navigations manquantes : cloche→notifcenter, « Ouvrir » reversement→payout, « Gérer les zones »→zones, « Page de suivi publique »→suivi public, « Modifier le créneau »→créneau.

**P2 — faux contrôles à rendre réels ou à retirer :**
- Filtres Ville/Marchand/Livreur (Lot 1), recherche marchand, pagination, selects Région/Province/Commune, champs de grille tarifaire, recherche FAQ.

**P3 — fonctions inexistantes de fond (décider si maquette suffit) :**
- Tous les **Export** (comptable, PDF, enquêtes, grille), génération de factures, upload de documents, éditeur de modèles de notif, régénération de clé API, ajout de webhook, dessin de polygone de zone, sélecteur GPS.

---

## 8. Recommandation d'implémentation

Beaucoup de P1 se règlent en réutilisant le **`Store` partagé** (`lib.jsx`) déjà en place : il gère l'état des commandes/livreurs de façon réactive. Étendre ce `Store` (ou en ajouter un par domaine : tenants, cash, retours, fraude) permettrait de brancher la majorité des actions de statut d'un coup, exactement comme le Lot 1 le fait déjà pour les commandes. Les **Export** peuvent, en maquette, se contenter d'un toast « Fichier généré » plutôt que d'un vrai fichier, si le réalisme suffit.
