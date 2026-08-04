# Système de design partagé — extrait de `transpo/lib.jsx`

Distillé depuis la maquette. Fait foi avec `lot3-app-livreur.jsx`.

## Thème

```js
{ accentColor: 'indigo', grayColor: 'slate', radius: 'medium', scaling: '100%', panelBackground: 'solid' }
```

## Statuts — couleur et variante Radix (badge `radius: 'full'`, `variant: 'soft'`)

| Statut | Couleur | FR | AR |
|---|---|---|---|
| `PROGRAMMEE` | gray | Programmée | مبرمجة |
| `NOUVELLE` | blue | Nouvelle | جديدة |
| `ASSIGNEE` | indigo | Assignée | مُسندة |
| `RETRAIT` | cyan | En route (retrait) | في الطريق (الاستلام) |
| `RECUPEREE` | violet | Récupérée | تم الاستلام |
| `LIVRAISON` | amber | En route (livraison) | في الطريق (التسليم) |
| `LIVREE` | green | Livrée | تم التسليم |
| `ECHOUEE` | red | Échouée | فشل |
| `RETOUR` | orange | Retour | إرجاع |
| `ANNULEE` | gray (`variant: 'surface'`) | Annulée | ملغاة |

Ces valeurs existent déjà dans `@transpo/domain` (`STATUS_META`) — les réutiliser, ne pas les redéfinir.

## `CodChip`

Badge `radius: 'full'`, `soft`. Vert si encaissé, ambre sinon.

- FR : `COD encaissé · <montant>` / `COD à encaisser · <montant>`
- AR : `حُصّل: <montant>` / `للتحصيل: <montant>`
- Néant si montant nul : `—` en gris

## `money`

`Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` + `' DH'`.
⚠️ La version du dépôt (`@transpo/domain`) ajoute un **isolat directionnel** U+2066…U+2069
indispensable en RTL — la garder, ne pas revenir à la version de la maquette.

## Primitives de l'app livreur (`lot3.jsx`)

```jsx
PhoneShell   // StatusBar (44px) + contenu + barre d'onglets (64px, masquable)
BottomAction // position absolute bas, padding space-3, dégradé vers le fond
PrimaryBtn   // Button size 4, width 100%, height 52
ScreenHead   // retour 44×44 + Heading size 4 + sous-titre size 1 gris, bordure basse
```

## Barre d'onglets

| id | FR | AR | Icône |
|---|---|---|---|
| `missions` | Missions | المهام | Archive |
| `route` | Tournée | الجولة | Stack |
| `scan` | Scanner | مسح | Camera |
| `shift` | Shift | الوردية | LapTimer |
| `profil` | Profil | الملف | Person |

Actif : `indigo-11`. Inactif : `gray-9`. Icône 20 px, label `size 1`, `paddingBottom: 6`.

## Objectifs & primes (`GOALS`, partagé avec le back-office)

Courses livrées (30/semaine, 300 DH) · Note moyenne (4,5, 150 DH) ·
Taux de réussite (95 %/mois, 400 DH) · Ponctualité (90 %/semaine, 120 DH)
