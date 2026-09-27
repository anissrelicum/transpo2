import * as path from 'node:path';
import { test, expect } from '@playwright/test';
import { loginTenant, nextAlert, shotDir } from './helpers';

// RETEST BUG-R2 bis — correctif du chemin « Changer de rôle » déployé le 22/09.
// Après un refus (dernier admin) OU un succès de changement de rôle, le menu « … »
// ET le dialogue doivent être fermés : 0 surcouche, tableau visible et interactif
// IMMÉDIATEMENT, sans Échap ni reload. Cette spec n'en envoie volontairement aucun.
test('RETEST BUG-R2 bis — rétrogradation refusée puis changement de rôle réussi', async ({ page }) => {
  test.setTimeout(150_000);
  const dir = shotDir('TC-B14');
  const shot = (name: string) => page.screenshot({ path: path.join(dir, `${name}.png`) });
  const overlays = page.locator('[role="menu"], [role="alertdialog"], [role="dialog"]');
  const aucuneSurcouche = async (etape: string) => {
    // Délai court pour la sortie d'animation Radix, mais AUCUN Escape.
    await expect(overlays, `${etape} : surcouche(s) encore ouverte(s)`).toHaveCount(0, { timeout: 5_000 });
    const pe = await page.evaluate(() => getComputedStyle(document.body).pointerEvents);
    console.log(`BUG-R2bis ${etape} : surcouches=0, pointer-events=${pe}`);
  };

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  const adminRow = page.getByRole('row', { name: /admin@rabatexpress\.ma/ });
  await expect(adminRow).toBeVisible();

  const nbAdmins = await page.getByRole('row').filter({ hasText: 'Administrateur' }).count();
  console.log(`BUG-R2bis : ${nbAdmins} ligne(s) avec le rôle Administrateur`);
  expect(nbAdmins).toBe(1);

  // 1. Rétrograder le dernier admin → refus → menu ET dialogue fermés SANS Échap.
  await adminRow.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  // Le menu doit déjà être fermé pendant que le dialogue est ouvert.
  await expect(page.getByRole('menu'), 'menu encore ouvert pendant le dialogue').toHaveCount(0, { timeout: 5_000 });
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Changer de rôle')).toBeVisible();
  await dlg.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Comptable' }).click();
  const alert1 = nextAlert(page);
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  expect(await alert1).toContain('dernier administrateur');
  await shot('retest-r2bis-01-apres-refus-retrogradation');
  await aucuneSurcouche('après refus rétrogradation');
  await expect(adminRow.getByText('Administrateur')).toBeVisible();

  // 2. Interactivité immédiate : on rouvre un menu « … » sans Échap préalable.
  const dispRow = page.getByRole('row', { name: /dispatch@rabatexpress\.ma/ });
  await dispRow.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg2 = page.getByRole('dialog');
  await dlg2.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Comptable' }).click();
  await dlg2.getByRole('button', { name: 'Enregistrer' }).click();
  // Succès : dialogue et menu fermés, badge basculé sans reload (router.refresh seul).
  await aucuneSurcouche('après changement de rôle réussi');
  const t0 = Date.now();
  await expect(dispRow.getByText('Comptable', { exact: true })).toBeVisible({ timeout: 15_000 });
  console.log(`BUG-R2bis : badge « Comptable » sans reload en ${Date.now() - t0} ms`);
  await shot('retest-r2bis-02-dispatcher-devenu-comptable-sans-reload');

  // 3. Retour au rôle Dispatcher (remise en état) — mêmes exigences.
  await dispRow.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg3 = page.getByRole('dialog');
  await dlg3.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Dispatcher' }).click();
  await dlg3.getByRole('button', { name: 'Enregistrer' }).click();
  await aucuneSurcouche('après retour Dispatcher');
  await expect(dispRow.getByText('Dispatcher', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shot('retest-r2bis-03-dispatcher-retabli-sans-reload');

  // 4. Preuve finale : le tableau est encore interactif.
  await adminRow.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Désactiver' })).toBeVisible();
  await shot('retest-r2bis-04-tableau-interactif-menu-rouvert');
});
