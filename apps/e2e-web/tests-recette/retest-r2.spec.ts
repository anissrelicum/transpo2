import * as path from 'node:path';
import { test, expect } from '@playwright/test';
import { loginTenant, nextAlert, shotDir } from './helpers';

// RETEST BUG-R2 — après le refus d'une action sur le dernier administrateur,
// le menu « … » ET le dialogue doivent être refermés : le tableau redevient
// visible et interactif IMMÉDIATEMENT, sans appuyer sur Échap.
// Cette spec n'envoie volontairement AUCUN Escape après les refus.
test('RETEST BUG-R2 — menu et dialogue refermés après refus dernier admin', async ({ page }) => {
  test.setTimeout(120_000);
  const dir = shotDir('TC-B14');
  const shot = (name: string) => page.screenshot({ path: path.join(dir, `${name}.png`) });
  const overlays = page.locator('[role="menu"], [role="alertdialog"], [role="dialog"]');
  const aucuneSurcouche = async (etape: string) => {
    // Délai court pour la sortie d'animation Radix, mais AUCUN Escape.
    await expect(overlays, `${etape} : surcouche(s) encore ouverte(s)`).toHaveCount(0, { timeout: 5_000 });
    const ariaHidden = await page.evaluate(
      () => document.getElementById('__next')?.getAttribute('aria-hidden')
        ?? document.body.firstElementChild?.getAttribute('aria-hidden') ?? 'absent',
    );
    const pe = await page.evaluate(() => getComputedStyle(document.body).pointerEvents);
    console.log(`BUG-R2 ${etape} : surcouches=0, aria-hidden racine=${ariaHidden}, pointer-events=${pe}`);
  };

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  const row = page.getByRole('row', { name: /admin@rabatexpress\.ma/ });
  await expect(row).toBeVisible();

  // Garde-fou : le compte doit être le SEUL administrateur, sinon le refus ne se déclenche pas.
  const nbAdmins = await page.getByRole('row').filter({ hasText: 'Administrateur' }).count();
  console.log(`BUG-R2 : ${nbAdmins} ligne(s) avec le rôle Administrateur`);
  expect(nbAdmins).toBe(1);

  // 1. Désactiver le dernier admin → refus → surcouches refermées SANS Échap.
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Désactiver' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText(/Désactiver Nadia Alaoui/)).toBeVisible();
  const alert1 = nextAlert(page);
  await confirm.getByRole('button', { name: 'Désactiver' }).click();
  expect(await alert1).toContain('dernier administrateur');
  await shot('retest-r1r2-01-apres-refus-desactivation');
  await aucuneSurcouche('après refus désactivation');
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();

  // 2. Interactivité immédiate du tableau : on rouvre le menu « … » directement.
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Comptable' }).click();
  const alert2 = nextAlert(page);
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  expect(await alert2).toContain('dernier administrateur');
  await shot('retest-r1r2-02-apres-refus-retrogradation');
  await aucuneSurcouche('après refus rétrogradation');
  await expect(row.getByText('Administrateur')).toBeVisible();

  // 3. Preuve finale d'interactivité : un troisième menu s'ouvre sans Échap préalable.
  await row.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Désactiver' })).toBeVisible();
  await shot('retest-r1r2-03-tableau-interactif-menu-rouvert');
});
