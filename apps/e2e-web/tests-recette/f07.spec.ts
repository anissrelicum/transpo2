import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, creerCommandes } from './helpers';

// TC-F07 — Actions de masse.
// PAS : /orders → cocher 3 commandes → Assigner ; puis cocher 2 commandes → Faire avancer.
// ATT : les actions s'appliquent à toute la sélection ; la sélection se vide ensuite.
test('TC-F07 — actions de masse sur une sélection', async ({ page }) => {
  test.setTimeout(240_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/orders');

  // Décor : trois commandes neuves dédiées au cas.
  const refs = await creerCommandes(page, [
    { merchant: 'Masse Test', toCity: 'Salé' },
    { merchant: 'Masse Test', toCity: 'Salé' },
    { merchant: 'Masse Test', toCity: 'Salé' },
  ]);
  console.log(`décor → ${refs.join(', ')}`);
  await page.reload();

  // On isole le décor par la recherche, pour cocher exactement ces trois lignes.
  await page.getByPlaceholder('Réf, code, marchand, ville…').fill('Masse Test');
  await expect(page.getByTestId('orders-count')).toHaveText('3 résultat(s)');
  for (const ref of refs) {
    await page.getByRole('row', { name: new RegExp(ref) }).getByRole('checkbox').check();
  }
  await expect(page.getByText('3 sélectionnée(s)')).toBeVisible();
  await shotVp(page, 'TC-F07', '01-trois-selectionnees');

  // L'action de masse demande À QUI affecter : elle ne choisit plus le premier venu.
  await page.getByRole('button', { name: 'Assigner' }).click();
  await page.getByRole('menuitem', { name: 'Hamid Ouali' }).click();
  await expect(page.getByText('3 sélectionnée(s)')).toHaveCount(0, { timeout: 30_000 });
  await page.reload();
  await page.getByPlaceholder('Réf, code, marchand, ville…').fill('Masse Test');
  const apresAssign = sql(
    `SELECT count(*) FROM tenant_rabatexpress.orders WHERE merchant='Masse Test' AND status='ASSIGNEE' AND driver='Hamid Ouali'`,
  );
  console.log(`assignées par l'action de masse → ${apresAssign}`);
  expect(Number(apresAssign)).toBe(3);
  await shotVp(page, 'TC-F07', '02-trois-assignees');

  // Puis deux d'entre elles avancent d'un pas.
  for (const ref of refs.slice(0, 2)) {
    await page.getByRole('row', { name: new RegExp(ref) }).getByRole('checkbox').check();
  }
  await expect(page.getByText('2 sélectionnée(s)')).toBeVisible();
  await page.getByRole('button', { name: 'Faire avancer' }).click();
  await expect(page.getByText('2 sélectionnée(s)')).toHaveCount(0, { timeout: 30_000 });
  await page.reload();
  const apresAvance = sql(
    `SELECT count(*) FROM tenant_rabatexpress.orders WHERE merchant='Masse Test' AND status='RETRAIT'`,
  );
  console.log(`avancées par l'action de masse → ${apresAvance}`);
  expect(Number(apresAvance)).toBe(2);
  await shotVp(page, 'TC-F07', '03-deux-avancees');
});
