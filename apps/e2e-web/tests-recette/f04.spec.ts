import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql } from './helpers';

// TC-F04 — Assignation depuis la liste.
// PAS : /orders → menu « … » → Assigner un livreur › Hamid Ouali.
// ATT : statut Assignée, chauffeur affiché ; le chauffeur déjà affecté est marqué d'un ✓.
test('TC-F04 — assignation depuis la liste des commandes', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/orders');

  // On prend une commande encore Nouvelle.
  const ref = sql(`SELECT ref FROM tenant_rabatexpress.orders WHERE status='NOUVELLE' ORDER BY created_at LIMIT 1`);
  console.log(`commande visée → ${ref}`);
  expect(ref).toMatch(/^CMD-/);
  const ligne = page.getByRole('row', { name: new RegExp(ref) });
  await expect(ligne.getByText('Nouvelle')).toBeVisible();
  await shotVp(page, 'TC-F04', '01-commande-nouvelle');

  await ligne.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Assigner un livreur' }).click();
  await page.getByRole('menuitem', { name: 'Hamid Ouali', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.reload();

  await expect(ligne.getByText('Assignée')).toBeVisible({ timeout: 15_000 });
  await expect(ligne.getByText('Hamid Ouali')).toBeVisible();
  expect(sql(`SELECT status, driver FROM tenant_rabatexpress.orders WHERE ref='${ref}'`)).toBe('ASSIGNEE | Hamid Ouali');
  await shotVp(page, 'TC-F04', '02-commande-assignee');

  // Le chauffeur déjà affecté est marqué d'un ✓ dans le menu.
  await ligne.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Assigner un livreur' }).click();
  await expect(page.getByRole('menuitem', { name: '✓ Hamid Ouali' })).toBeVisible();
  await shotVp(page, 'TC-F04', '03-chauffeur-coche');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
});
