# PRD — Transpo · Authentification (tous profils)

Retour à [PRD-00-Vue-Ensemble.md](PRD-00-Vue-Ensemble.md).

**Source analysée** : `transpo/lot15.jsx` (généré par Claude Design, fichier `Transpo - Auth (login, 2FA, SSO).dc.html`, ajouté au lanceur d'accueil dans une nouvelle section « Connexion »).

Écran transverse : couvre l'entrée dans la **Console transport** (admin/dispatcher), le **Portail marchand** et la **Console SaaS**. L'app livreur avait déjà son propre login (voir [PRD-Lot3](PRD-Lot3-App-Livreur.md) §5.1) ; ce module complète les trois interfaces web qui en étaient dépourvues.

---

## 1. Profils et parcours

Trois profils sélectionnables, chacun avec son accent de marque et ses options :

| Profil | Rôle | Accent | 2FA | SSO |
|---|---|---|---|---|
| Console transport | ADMIN · DISPATCHER | indigo | ✅ | ❌ |
| Portail marchand | MERCHANT | grass | ✅ | ❌ |
| Console SaaS | SUPER_ADMIN (exploitant) | violet | ✅ | ✅ |

Le **SSO/SAML n'est proposé que pour la Console SaaS** (cohérent avec l'offre : le SSO/SAML est une fonctionnalité du plan Grand Compte, voir [PRD-05](PRD-05-Console-SaaS.md) §3).

## 2. Écrans

- **Login** : e-mail professionnel + mot de passe (avec bascule afficher/masquer), lien « mot de passe oublié », bouton principal avec état de chargement, mention « Connexion chiffrée · <domaine> ». Si le profil supporte le SSO, bouton SSO en haut + séparateur « ou ».
- **Mot de passe oublié** : saisie e-mail → écran de confirmation « E-mail envoyé » (lien valable 30 min), retour à la connexion.
- **Double authentification (2FA)** : saisie d'un code à 6 chiffres (6 champs individuels, auto-avancement au remplissage, retour arrière intelligent), envoi vers un téléphone masqué (`+212 6 •• •• 84 90`), « Renvoyer le code ».
- **SSO / SAML** (SaaS uniquement) : saisie du domaine de l'organisation, callout « redirection vers Okta / Azure AD », bouton avec état de chargement.
- **Succès** : confirmation « Connecté » + redirection annoncée vers le tableau de bord.

## 3. Cohérence et conventions

- Réutilise `window.Transpo` (`THEME`, `RocketIcon`), cadre centré (max 400 px), logo indigo — même identité que le login livreur existant.
- Thème clair/sombre, cibles ≥ 44 px.
- Bandeau d'atelier (démo) permettant de basculer profil / étape / thème.

## 4. Points ouverts / réserves

1. **C'est une vitrine (showcase), pas un vrai gate.** Le module montre les écrans mais n'est pas branché *en amont* de chaque console réelle (Console complète, Portail marchand, Console SaaS démarrent toujours directement sur leur dashboard). En production, il faut faire de cet écran la véritable porte d'entrée conditionnant l'accès.
2. **2FA** : le canal (SMS vs application d'authentification) n'est pas choisi — la maquette suppose un SMS. À trancher, sachant que le SMS implique la conformité Loi 09-08 (consentement) déjà présente ailleurs ([PRD-01](PRD-01-Console-Admin-Dispatcher.md) §15).
3. **SSO** : les fournisseurs cités (Okta / Azure AD) sont illustratifs — définir la liste réelle d'IdP supportés et le protocole exact (SAML 2.0 vs OIDC).
4. **Bilingue** : l'écran d'auth est en FR uniquement dans la maquette — à étendre en FR/AR pour le portail marchand (exposé à des marchands arabophones), au minimum.
5. Aucune trace de **gestion de session / déconnexion / expiration** ni de **rôles à la connexion** (un compte Console transport peut être Admin *ou* Dispatcher *ou* Comptable — le routage post-login selon le rôle n'est pas spécifié).
