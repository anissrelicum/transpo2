import * as path from 'node:path';
import { test, expect } from '@playwright/test';
import { loginTenant, nextAlert, shotDir } from './helpers';

// RETEST BUG-R2 ter — 3e correctif : dialogue « Changer de rôle » rendu en FRÈRE du
// DropdownMenu (cause racine de l'auto-fermeture). Protocole complet, SANS Échap ni reload :
// 1. persistance du dialogue (sonde temporelle) ; 2. refus dernier admin → tout fermé ;
// 3. chemin succès dispatcher → comptable → dispatcher ; 4. témoins sains.
test('RETEST BUG-R2 ter — dialogue persistant, refus propre, succès propre', async ({ page }) => {
  test.setTimeout(180_000);
  const dir = shotDir('TC-B14');
  const shot = (name: string) => page.screenshot({ path: path.join(dir, `${name}.png`) });
  const overlays = page.locator('[role="menu"], [role="alertdialog"], [role="dialog"]');
  const aucuneSurcouche = async (etape: string) => {
    await expect(overlays, `${etape} : surcouche(s) encore ouverte(s)`).toHaveCount(0, { timeout: 5_000 });
    const pe = await page.evaluate(() => getComputedStyle(document.body).pointerEvents);
    console.log(`R2ter ${etape} : surcouches=0, pointer-events=${pe}`);
  };

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  const adminRow = page.getByRole('row', { name: /admin@rabatexpress\.ma/ });
  const dispRow = page.getByRole('row', { name: /dispatch@rabatexpress\.ma/ });
  await expect(adminRow).toBeVisible();
  expect(await page.getByRole('row').filter({ hasText: 'Administrateur' }).count()).toBe(1);

  // ── 1. Persistance du dialogue « Changer de rôle » (sonde temporelle) ──
  await adminRow.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Changer de rôle')).toBeVisible();
  for (const t of [0, 1000, 3000]) {
    if (t) await page.waitForTimeout(t === 1000 ? 1000 : 2000);
    const n = await page.locator('[role="dialog"]').count();
    console.log(`R2ter sonde : dialog présent à t=${t} ms → ${n > 0}`);
    expect(n, `dialogue auto-fermé à t=${t} ms`).toBe(1);
  }
  await shot('retest-r2ter-01-dialogue-persistant-t3s');
  // Combobox cliquable : la liste des rôles s'ouvre.
  await dlg.getByRole('combobox').click();
  await expect(page.getByRole('option', { name: 'Comptable' })).toBeVisible();
  await page.getByRole('option', { name: 'Comptable' }).click();
  console.log('R2ter : combobox cliquable, option Comptable sélectionnée');

  // ── 2. Refus dernier admin → menu ET dialogue fermés, sans Échap ──
  const alert1 = nextAlert(page);
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  expect(await alert1).toContain('dernier administrateur');
  await shot('retest-r2ter-02-apres-refus-retrogradation');
  await aucuneSurcouche('après refus rétrogradation');
  await expect(adminRow.getByText('Administrateur')).toBeVisible();

  // ── 3. Chemin succès : dispatcher → comptable → dispatcher ──
  await dispRow.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg2 = page.getByRole('dialog');
  await dlg2.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Comptable' }).click();
  await dlg2.getByRole('button', { name: 'Enregistrer' }).click();
  await aucuneSurcouche('après changement dispatcher→comptable');
  const t0 = Date.now();
  await expect(dispRow.getByText('Comptable', { exact: true })).toBeVisible({ timeout: 15_000 });
  console.log(`R2ter : badge « Comptable » sans reload en ${Date.now() - t0} ms`);
  await shot('retest-r2ter-03-dispatcher-devenu-comptable');

  await dispRow.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg3 = page.getByRole('dialog');
  await dlg3.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Dispatcher' }).click();
  await dlg3.getByRole('button', { name: 'Enregistrer' }).click();
  await aucuneSurcouche('après retour dispatcher');
  await expect(dispRow.getByText('Dispatcher', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shot('retest-r2ter-04-dispatcher-retabli');

  // ── 4a. Témoin : « Désactiver » le dernier admin → refus → tout fermé ──
  await adminRow.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Désactiver' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText(/Désactiver Nadia Alaoui/)).toBeVisible();
  const alert2 = nextAlert(page);
  await confirm.getByRole('button', { name: 'Désactiver' }).click();
  expect(await alert2).toContain('dernier administrateur');
  await aucuneSurcouche('après refus désactivation');
  await expect(adminRow.getByText('Actif', { exact: true })).toBeVisible();
  await shot('retest-r2ter-05-refus-desactivation-propre');

  // ── 4b. Témoin : « Réinitialiser le mot de passe » s'ouvre et persiste ──
  await dispRow.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Réinitialiser le mot de passe' }).click();
  const dlgReset = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await expect(dlgReset.first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await overlays.count(), 'dialogue reset auto-fermé').toBeGreaterThan(0);
  await shot('retest-r2ter-06-reset-mdp-persistant');
  // Fermeture propre par son bouton (pas Échap) : Annuler ou Fermer selon le dialogue.
  const fermer = dlgReset.getByRole('button', { name: /Annuler|Fermer/ }).first();
  await fermer.click();
  await aucuneSurcouche('après fermeture reset mdp');

  // ── 4c. Témoin : « Inviter » s'ouvre et se ferme par Annuler ──
  await page.getByRole('button', { name: 'Inviter' }).click();
  const dlgInv = page.getByRole('dialog');
  await expect(dlgInv.getByPlaceholder('Nom complet')).toBeVisible();
  await dlgInv.getByRole('button', { name: 'Annuler' }).click();
  await aucuneSurcouche('après annulation invitation');

  // ── Preuve finale d'interactivité ──
  await adminRow.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Désactiver' })).toBeVisible();
  await shot('retest-r2ter-07-tableau-interactif-final');
});
