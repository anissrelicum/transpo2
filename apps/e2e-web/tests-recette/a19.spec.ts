import { test, expect } from '@playwright/test';
import { loginSaas, nextAlert, shotVp, sql } from './helpers';

// TC-A19 — Code de plan en doublon : créer un plan avec un code déjà pris (« essai »).
// ATT : erreur « Plan déjà existant : essai », rien n'est créé.
test('TC-A19 — Code de plan en doublon', async ({ page }) => {
  test.setTimeout(120_000);
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
  await expect(page.locator('table tbody tr')).toHaveCount(5);

  await page.getByRole('button', { name: 'Nouveau plan' }).click();
  const dialog = page.getByRole('dialog');
  // Le code s'auto-remplit depuis le libellé : « Essai » → « essai » (déjà pris).
  await dialog.getByPlaceholder('Pay as you go').fill('Essai');
  await expect(dialog.getByPlaceholder('pay-as-you-go')).toHaveValue('essai');
  await dialog.getByPlaceholder('الدفع حسب الاستعمال').fill('تجربة');
  await shotVp(page, 'TC-A19', '01-code-doublon-saisi');

  const alertMsg = nextAlert(page);
  await dialog.getByRole('button', { name: 'Créer le plan' }).click();
  const msg = await alertMsg;
  console.log(`doublon essai → ${msg}`);
  expect(msg).toContain('Plan déjà existant : essai');
  await shotVp(page, 'TC-A19', '02-doublon-refuse-dialogue-ouvert');
  await dialog.getByRole('button', { name: 'Annuler' }).click();

  // Rien créé : toujours 5 plans, une seule ligne « essai ».
  await page.reload();
  await expect(page.locator('table tbody tr')).toHaveCount(5, { timeout: 30_000 });
  const n = sql("select count(*) from platform.plans where code='essai'");
  expect(n).toBe('1');
});
