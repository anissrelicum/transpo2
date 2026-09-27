import * as path from 'node:path';
import { test, expect } from '@playwright/test';
import { loginTenant, shotDir } from './helpers';

// RETEST BUG-R1 — cache RSC Next 14 : après (dés|ré)activation d'un utilisateur,
// le badge doit basculer via le SEUL router.refresh(), sans aucun reload manuel.
// Cette spec ne contient volontairement AUCUN page.reload() après les mutations.
test('RETEST BUG-R1 — badge Actif/Désactivé rafraîchi sans reload', async ({ page }) => {
  test.setTimeout(120_000);
  const dir = shotDir('TC-B13');
  const shot = (name: string) => page.screenshot({ path: path.join(dir, `${name}.png`) });

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  const row = page.locator('tr', { hasText: 'dispatch@rabatexpress.ma' }).first();
  await expect(row).toBeVisible();

  // Mise en place : le dispatcher doit partir de l'état « Actif ».
  // (Seul endroit où un reload est toléré : la préparation, pas la vérification.)
  if (await row.getByText('Désactivé', { exact: true }).count()) {
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'Réactiver' }).click();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  }
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();
  await shot('retest-r1-01-avant-badge-actif');

  // 1. Désactivation — puis attente du badge SANS reload (router.refresh() seul).
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Désactiver' }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: 'Désactiver' }).click();
  const t0 = Date.now();
  await expect(row.getByText('Désactivé', { exact: true })).toBeVisible({ timeout: 15_000 });
  console.log(`BUG-R1 : badge « Désactivé » sans reload en ${Date.now() - t0} ms`);
  const gele1 = await page.evaluate(() => getComputedStyle(document.body).pointerEvents);
  console.log(`BUG-R1 : pointer-events body après désactivation = ${gele1}`);
  await shot('retest-r1-02-badge-desactive-sans-reload');

  // 2. Réactivation — même exigence, toujours sans reload.
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Réactiver' }).click();
  const t1 = Date.now();
  await expect(row.getByText('Actif', { exact: true })).toBeVisible({ timeout: 15_000 });
  console.log(`BUG-R1 : badge « Actif » sans reload en ${Date.now() - t1} ms`);
  await shot('retest-r1-03-badge-actif-sans-reload');
});
