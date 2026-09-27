import * as path from 'node:path';
import { test, expect } from '@playwright/test';
import { loginTenant, shotDir } from './helpers';

// Captures du retest R2bis : le dialogue « Changer de rôle » s'ouvre puis se referme
// tout seul ~300-500 ms après le clic (régression du correctif BUG-R2).
test('RETEST BUG-R2 bis — captures du dialogue auto-fermé', async ({ page }) => {
  test.setTimeout(60_000);
  const dir = shotDir('TC-B14');
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  const row = page.getByRole('row', { name: /admin@rabatexpress\.ma/ });

  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  await page.screenshot({ path: path.join(dir, 'retest-r2bis-01-dialogue-juste-apres-clic.png') });
  await page.waitForTimeout(1000);
  const restants = await page.locator('[role="menu"], [role="alertdialog"], [role="dialog"]').count();
  console.log(`R2bis : surcouches 1 s après le clic « Changer de rôle » = ${restants}`);
  await page.screenshot({ path: path.join(dir, 'retest-r2bis-02-dialogue-auto-ferme-1s.png') });

  // La fonctionnalité est-elle utilisable ? On tente de sélectionner un rôle.
  const dlg = page.getByRole('dialog');
  const utilisable = await dlg.getByRole('combobox').isVisible().catch(() => false);
  console.log(`R2bis : dialogue « Changer de rôle » utilisable = ${utilisable}`);
  expect(restants, 'le dialogue devrait rester ouvert pour permettre le changement de rôle').toBeGreaterThan(0);
});
