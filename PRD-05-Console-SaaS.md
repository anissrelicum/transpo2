# PRD — Transpo · Console SaaS (Super-Admin / exploitant)

Retour à [PRD-00-Vue-Ensemble.md](PRD-00-Vue-Ensemble.md). Modèle de données et règles transverses : voir ce document, § 4 et § 5.

**Source analysée** : `transpo/lot5.jsx` (section Console SaaS, exportée séparément du suivi public dans le même fichier). Interface `/admin` réservée à l'équipe **Transpo elle-même** (l'éditeur SaaS), pas à un transporteur client.

---

> ✅ **Bilingue FR/AR** : la Console SaaS (`lot5.jsx`, écrans Tenants / Abonnements / Facturation / Paywall) a été internationalisée — dictionnaire `SAAS = {fr, ar}` + helper `useSaas(lang)` câblés dans tous les écrans, sélecteur de langue et `dir=rtl` ajoutés à `AdminApp` (tables de mapping pour villes/statuts/plans traduits). Elle bascule réellement en arabe.

## 1. Contexte

Transpo est vendu en marque blanche à des sociétés de transport (« tenants » : CasaExpress, Rabat Logistics, Atlas Courier, etc.). Cette console permet à l'équipe exploitante Transpo de gérer le cycle de vie commercial de ses clients transporteurs — provisioning, abonnement, facturation, blocage d'accès.

**Ne pas confondre** avec la Console transport (Admin/Dispatcher, [PRD-01](PRD-01-Console-Admin-Dispatcher.md)) qui est l'outil interne *d'un* tenant pour gérer *ses propres* commandes/livreurs.

## 2. Locataires / Tenants (`tenants`)

Table des organisations clientes : nom, ville, plan souscrit, statut (Actif/Essai/Suspendu/Impayé), nombre de véhicules, volume de commandes, ancienneté. KPI : tenants actifs, en essai, suspendus/impayés, **MRR** (Monthly Recurring Revenue) avec tendance.

Actions par tenant (menu contextuel) :
- **Voir la fiche** — détail complet.
- **Se connecter en tant que** (impersonation) — pour le support technique.
- **Suspendre / Réactiver** selon l'état courant.
- **Déprovisionner** (suppression, destructif — action rouge séparée).

**Point d'attention sécurité** : l'impersonation (« Se connecter en tant que ») doit être auditée/tracée en production — aucune trace de logging n'apparaît dans la maquette, à spécifier explicitement au design technique.

## 3. Abonnements & plans (`plans`)

5 niveaux de plan avec grille comparative (prix/mois, véhicules max, commandes max, fonctionnalités) :

| Plan | Prix | Véhicules | Commandes | Points clés |
|---|---|---|---|---|
| Essai | Gratuit · 14j | 10 | 200 | 1 dispatcher, suivi public, support email |
| TPE Coursier | 490 DH/mois | 5 | 500 | 3 dispatchers, API & webhooks |
| Transporteur | 1 990 DH/mois | 50 | ∞ | Dispatchers illimités, zones avancées, facturation auto |
| Grand Compte | 4 990 DH/mois | ∞ | ∞ | SLA 99,9%, account manager, SSO/SAML |
| Sur-mesure | Sur devis | ∞ | ∞ | Déploiement dédié, intégrations custom |

Suivi de **consommation du cycle courant** vs limites du plan (barres de progression véhicules/commandes/dispatchers), alerte quand proche de la limite.

## 4. Facturation plateforme (`billing`)

Factures émises **par Transpo vers ses tenants** (à distinguer de [PRD-01](PRD-01-Console-Admin-Dispatcher.md) § 9, qui sont les factures qu'un tenant émet à ses propres marchands). KPI : facturé ce mois, encaissé, impayé, en retard. Table de factures avec statut (Payée/Impayée/En retard), export comptable, relance groupée des impayés.

## 5. Écran de paiement bloquant (paywall)

Trois variantes selon la cause, présentées avec la console du tenant floutée en arrière-plan (le tenant voit que ses données existent mais ne peut plus interagir) :

1. **Impayé/suspendu** : facture spécifique en défaut, montant, CTA « Régler maintenant ».
2. **Essai expiré** : fin des 14 jours, CTA « Choisir un plan ».
3. **Limite atteinte** : ex. 50/50 véhicules du plan Transporteur, CTA « Augmenter la limite » vers le plan supérieur.

Toujours un lien de sortie de secours (Contacter le support / Se déconnecter).

**Règle centrale** : le paywall **bloque l'accès, jamais les données** — un tenant suspendu ou impayé garde son historique intact, seule l'interaction est gelée jusqu'à régularisation.

## 6. Règles métier spécifiques à la Console SaaS

1. **Isolation multi-tenant stricte** : aucune donnée (commandes, livreurs, factures) d'un tenant ne doit être visible par un autre — cette console n'agrège que des métadonnées de compte (plan, statut, volumes), jamais le détail opérationnel d'un tenant.
2. Le passage `ESSAI → ACTIF` ou tout changement de plan doit immédiatement recalculer les limites de consommation affichées en Console transport de ce tenant (ex. si un tenant Essai atteint son plafond de commandes, la création de commande doit être bloquée côté [PRD-01](PRD-01-Console-Admin-Dispatcher.md) § 2.2, pas seulement signalée ici).
3. **Point ouvert** : le type de rôle qui accède à cette console (super-admin Transpo) n'a aucun recouvrement de permissions avec les rôles Administrateur/Dispatcher/Comptable définis en [PRD-01](PRD-01-Console-Admin-Dispatcher.md) § 16 — à confirmer que ce sont bien deux systèmes d'authentification/autorisation distincts (compte Transpo interne vs compte tenant).
