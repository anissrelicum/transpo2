# Prompt pour Claude Design — Écrans manquants Transpo

> À copier-coller dans Claude Design, sur le projet **« Transpo — Prompts Claude Design »**.
> Tu peux tout envoyer d'un coup, ou section par section (chaque `###` est autonome).

---

## Contexte (à conserver en tête pour tous les écrans ci-dessous)

Complète le projet Transpo (plateforme de livraison last-mile marocaine) avec les écrans manquants listés plus bas. **Respecte impérativement les conventions déjà en place dans le projet :**

- React + Radix UI Themes, thème `accentColor="indigo"`, `grayColor="slate"`, `radius="medium"`, `panelBackground="solid"`.
- Bibliothèque partagée `window.Transpo` (`transpo/lib.jsx`) : réutilise `StatusBadge`, `money()` (format `1 250,00 DH`), `LeafletMap`, `PageHeader`, `KPI`, `EmptyState`, `ErrorState`, `Field`, `Shell`, le cycle de vie `STATUS` (PROGRAMMEE→NOUVELLE→ASSIGNEE→RETRAIT→RECUPEREE→LIVRAISON→LIVREE, + ECHOUEE/RETOUR/ANNULEE), `GOALS`, `DRIVERS`, `ORDERS`.
- Données de démonstration marocaines (Casablanca, Rabat, Marrakech, Tanger, Fès ; noms comme Youssef Benali, Salma Idrissi ; devise DH).
- Bilingue **FR/AR avec RTL complet** pour tout écran exposé au livreur, au client ou au marchand.
- Thème clair/sombre sur chaque interface. Cibles tactiles ≥ 44 px, action principale collée en bas sur mobile.
- Cadres mobiles = 390×844. Consoles desktop = layout `Shell` avec sidebar.
- Ajoute chaque nouvel écran au lanceur `transpo/home.jsx` dans la bonne section de profil.

---

### 1. Authentification (tous profils sauf livreur, qui l'a déjà)

Crée les écrans de connexion manquants pour la **Console transport** (admin/dispatcher), le **Portail marchand** et la **Console SaaS** :
- Écran de login (email + mot de passe, « mot de passe oublié », bouton principal).
- Écran mot de passe oublié (saisie email → confirmation d'envoi).
- Écran de double authentification (2FA) : saisie d'un code à 6 chiffres.
- Pour la Console SaaS / plan Grand Compte : une variante **SSO / SAML** (bouton « Se connecter avec le SSO de mon organisation »).
Style cohérent avec l'écran de login livreur existant (logo indigo, cadre centré).

### 2. Onboarding / recrutement livreur (mobile, 390×844)

Parcours d'inscription d'un nouveau livreur avant son premier shift :
- Saisie identité + téléphone.
- Upload des documents (permis de conduire recto/verso, carte grise, attestation d'assurance) avec états : à fournir / en vérification / validé / refusé.
- Choix du type de contrat (Salarié / Freelance) et du véhicule.
- Écran d'attente de validation (« Votre dossier est en cours de vérification »).
Réutilise les statuts de documents déjà présents dans l'écran « Mes documents » du livreur.

### 3. Ma caisse — livreur (mobile) — à intégrer au flux principal

Un écran « Ma caisse » existe déjà en démo autonome (`MobileCash`) mais **n'est pas dans la navigation de l'app livreur**. Intègre-le au parcours livreur (accessible depuis le Profil et/ou l'onglet Shift) :
- Cash en main cumulé depuis le dernier dépôt.
- Plafond de cash avec barre de progression colorée (vert → ambre 60 % → rouge 85 %) et alerte à l'approche.
- Liste des COD encaissés depuis le dernier dépôt.
- Action « Déposer en agence » → génère un bordereau, remet la caisse à zéro.
Doit être consultable **en cours de shift**, pas seulement à la clôture.

### 4. Reversement COD au marchand (Console transport, admin)

Le circuit « cash → agence » existe (réconciliation) mais **le reversement agence → marchand n'a aucun écran**. Crée-le :
- Liste des marchands avec COD collecté net à reverser (montant, période, déduction de commission).
- Détail d'un reversement : commandes concernées, COD brut − commission 15 % = net à virer.
- Action « Générer le virement » / « Marquer comme reversé » avec bordereau et référence.
- Statuts : à reverser / en cours / reversé.

### 5. Annulation / remboursement avec COD déjà encaissé (Console transport)

Cas métier absent : que se passe-t-il quand un colis est annulé ou retourné **après** que le COD a été encaissé ? Crée un écran/flux de remboursement :
- Détection des commandes annulées/retournées avec COD payé.
- Décision : rembourser le client, re-créditer le marchand, ou retenir.
- Traçabilité de la transaction inverse.

### 6. Notifications reçues — Console admin (desktop)

L'admin *configure* les notifications mais n'a pas de **centre de notifications pour lui-même** (le livreur en a un). Crée un panneau/centre de notifications admin : alertes de conformité (assurance/CT/permis expirés), sorties de géofence, écarts de caisse, litiges ouverts, SLA en breach — avec compteur de non-lues et marquage lu.

### 7. Support / chat pour le client final (mobile)

Le livreur a un chat dispatch, le client final n'a que « appeler ». Ajoute un écran de messagerie côté client final (chat avec le livreur ou le support), avec réponses rapides suggérées, cohérent avec le chat dispatch existant du livreur.

### 8. Confirmation / conséquence du choix de créneau client (mobile + dispatch)

Quand le client final choisit ou modifie son créneau (écran existant), montre la **conséquence** : écran de confirmation côté client + impact côté dispatch/tournée (re-planification de l'arrêt). Aujourd'hui l'action n'a aucun effet visible.

### 9. Modération des avis clients (Console admin)

Le client note le livreur, mais **aucun écran ne gère les avis** (surtout négatifs). Crée un écran de modération : liste des avis récents, filtrage par note, signalement d'un avis abusif, réponse/contexte, impact sur le score du livreur (avec revue humaine, comme la fraude COD).

---

## Cohérences à corriger au passage

- **`proof_level`** : l'API marchand utilise `photo_signature`, l'app livreur `photo_sig`. Uniformise la nomenclature (ou documente le mapping).
- **Multi-langue incomplète** : étends FR/AR aux écrans aujourd'hui FR uniquement (Console SaaS, Flotte, Facturation, Analytics) si tu les régénères.
- **Double facturation marchand** : clarifie par un écran ou une note le rapport entre le portefeuille prépayé et les factures mensuelles post-payées (lequel s'applique selon le type de contrat marchand).
