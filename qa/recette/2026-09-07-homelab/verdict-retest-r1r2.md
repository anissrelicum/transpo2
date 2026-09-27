# Verdict retest BUG-R1 / BUG-R2 — homelab, 22/09/2026

Cible : `http://app.wedowonders.com` (tenant `rabatexpress`, compte `admin@rabatexpress.ma`).
Specs jouées en vrai navigateur (Chromium / Playwright) :
`apps/e2e-web/tests-recette/retest-r1.spec.ts` et `retest-r2.spec.ts`, avec
`RUN_ID=2026-09-07-homelab WEB_URL=http://app.wedowonders.com API_URL=http://transpo-api.wedowonders.com`.
Aucun `page.reload()` ni touche Échap après les mutations : c'est précisément ce que les specs vérifient.

## BUG-R1 (cache RSC Next 14 — badge non rafraîchi) : **CORRIGÉ**

- Désactivation du dispatcher `dispatch@rabatexpress.ma` depuis `/users` : le badge passe à
  « Désactivé » en **381 ms** via le seul `router.refresh()`, sans reload. Les compteurs
  d'en-tête basculent aussi (8→7 actifs, 0→1 inactif) et `pointer-events` du body reste `auto`.
- Réactivation : badge « Actif » en **374 ms**, toujours sans reload.
- Preuves : `TC-B13/retest-r1-01-avant-badge-actif.png`,
  `TC-B13/retest-r1-02-badge-desactive-sans-reload.png`,
  `TC-B13/retest-r1-03-badge-actif-sans-reload.png` (visionnées — badge et compteurs corrects).
- Conséquence : les deux `page.reload()` de contournement dans
  `apps/e2e-web/tests/tenant-users.spec.ts` (lignes 88 et 103) sont devenus inutiles.

## BUG-R2 (menu/dialogue survivant à un refus) : **PERSISTANT sur le chemin « Changer de rôle »** (corrigé sur « Désactiver »)

- **Refus de désactivation du dernier admin : corrigé.** L'alerte « … dernier administrateur … »
  s'affiche, puis menu ET alertdialog sont refermés : 0 surcouche, racine sans `aria-hidden`,
  `pointer-events: auto`, tableau visible et interactif immédiatement (preuve : on rouvre le
  menu « … » juste après sans Échap). Capture : `TC-B14/retest-r1r2-01-apres-refus-desactivation.png`.
- **Refus de rétrogradation du dernier admin : le bug persiste.** Après l'alerte
  « … dernier administrateur … », le dialogue « Changer de rôle » **et** le menu « … » restent
  ouverts indéfiniment (> 5 s, encore 2 surcouches `[role=dialog]` + `[role=menu]` au timeout),
  masquant le tableau. On note aussi que le menu « … » n'est déjà pas fermé à l'ouverture du
  dialogue (les deux sont empilés). Captures : `TC-B14/retest-r1r2-02-apres-refus-retrogradation.png`
  et `artefacts/retest-r2-…/test-failed-1.png` (état identique après 5 s).
- Reproduction : `/users` → menu « … » de la ligne `admin@rabatexpress.ma` → « Changer de rôle »
  → choisir « Comptable » → « Enregistrer » → alerte de refus → les deux surcouches restent
  ouvertes, le tableau est inaccessible sans Échap.

## Conséquence sur le helper `closeOverlays`

`closeOverlays` (`apps/e2e-web/tests/helpers.ts:143`) n'est **pas** encore un no-op :
il reste indispensable après le refus de rétrogradation (2e appel, `tenant-users.spec.ts:139`).
Après le refus de désactivation (1er appel, `tenant-users.spec.ts:127`), il est devenu un no-op.

---

# Retest BUG-R2 bis — second correctif « Changer de rôle », 22/09/2026 : **PERSISTANT — régression aggravée**

Second déploiement du correctif (transpo-web reconstruit). Specs :
`apps/e2e-web/tests-recette/retest-r2bis.spec.ts` (refus rétrogradation + chemin succès
dispatcher → comptable → dispatcher), `retest-r2bis-captures.spec.ts` et la sonde
`sonde-r2bis.spec.ts`.

**Constat : le dialogue « Changer de rôle » s'ouvre puis SE REFERME TOUT SEUL ~300-500 ms
après le clic, sans aucune interaction.** La fonctionnalité est inutilisable : impossible
de sélectionner un rôle, donc impossible d'atteindre ni le refus (dernier admin) ni un
succès. Le clic sur le combobox échoue (« element not stable » puis « detached from the DOM »,
timeout 150 s — voir `artefacts/retest-r2bis-…/test-failed-1.png`).

Preuves (visionnées) :
- `TC-B14/retest-r2bis-01-dialogue-juste-apres-clic.png` : dialogue visible juste après le clic
  (le menu « … », lui, est bien fermé — ce point du correctif fonctionne) ;
- `TC-B14/retest-r2bis-02-dialogue-auto-ferme-1s.png` : 1 s plus tard, 0 surcouche, dialogue
  disparu spontanément ;
- sonde temporelle : `[role=dialog]` présent à t=0 ms, absent dès t≈300 ms et ne réapparaît
  jamais (échantillonnage 3 s).

Témoins sains (sonde) : « Réinitialiser le mot de passe » (dialogue persiste), « Désactiver »
(alertdialog persiste), « Inviter » (bouton hors menu, persiste). La régression est donc
spécifique au dialogue « Changer de rôle » ouvert depuis le menu « … ».

Reproduction : `/users` → menu « … » d'une ligne quelconque → « Changer de rôle » →
le dialogue apparaît puis disparaît seul en moins d'une demi-seconde.

Note d'environnement : pendant le retest, un redéploiement a invalidé le mot de passe de
`admin@rabatexpress.ma` ; il a été reposé à `Test1234` via le CLI documenté
(`kubectl exec deploy/transpo-api -- pnpm --filter @transpo/db account …`, §0.3), puis le
retest a été intégralement rejoué sur le déploiement final — même verdict.

## Conséquence sur `closeOverlays` (verdict final)

`closeOverlays` n'est **toujours pas** un no-op complet. Pire : la spec de régression
`tenant-users.spec.ts` échouerait désormais AVANT le 2e `closeOverlays`, au clic sur le
combobox du dialogue (qui se ferme tout seul). Le correctif doit être repris : fermer le
menu à l'ouverture du dialogue sans refermer le dialogue lui-même, et ne fermer menu +
dialogue qu'APRÈS un refus.

---

# Retest BUG-R2 ter — 3e correctif (dialogue FRÈRE du DropdownMenu), 22/09/2026 : **CORRIGÉ**

Correctif de la cause racine (le dialogue « Changer de rôle » n'est plus enfant du
DropdownMenu). Spec : `apps/e2e-web/tests-recette/retest-r2ter.spec.ts` — **1 passed (17,9 s)**,
sans Échap ni reload. Captures `TC-B14/retest-r2ter-*.png`, toutes visionnées.

1. **Persistance du dialogue : OK.** Présent à t=0, t=1 s, t=3 s (capture 01) ; combobox
   cliquable, liste des rôles s'ouvre, option sélectionnable.
2. **Refus dernier admin : OK.** Rétrogradation Nadia Alaoui → Comptable : alerte
   « … dernier administrateur … », puis 0 surcouche, `pointer-events: auto`, tableau
   immédiatement visible et interactif (capture 02), rôle « Administrateur » inchangé.
3. **Chemin succès : OK.** Dispatcher → Comptable : dialogue fermé, badge « Comptable »
   affiché en **19 ms** sans reload (capture 03) ; retour à Dispatcher idem (capture 04).
4. **Témoins sains : OK.** Refus de désactivation du dernier admin → tout fermé (capture 05) ;
   « Réinitialiser le mot de passe » → dialogue persistant et fermable par son bouton
   (capture 06 — le reset a réellement eu lieu : nouveau mot de passe du dispatcher
   consigné dans `COMPTES.md`) ; « Inviter » s'ouvre et se ferme par Annuler ;
   menu « … » encore ouvrable en fin de parcours (capture 07).

## Conséquence sur `closeOverlays` (verdict final BUG-R2)

`closeOverlays` est désormais un **no-op complet** : après chacun des deux refus
(désactivation ET rétrogradation), menu et dialogue sont déjà fermés — les deux appels
de `tenant-users.spec.ts:127,139` peuvent être supprimés, de même que les `page.reload()`
de contournement BUG-R1 (lignes 88 et 103).
