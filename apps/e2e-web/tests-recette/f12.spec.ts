import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, creerCommandes, motDePasse } from './helpers';

// TC-F12 — Annulation.
// PAS : sur une commande non terminale → Annuler.
// ATT : statut Annulée ; l'action devient indisponible sur les commandes Livrée et Annulée.
test('TC-F12 — annulation d’une commande', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/orders');

  const [ref] = await creerCommandes(page, [{ merchant: 'Annulation Test', toCity: 'Oujda' }]);
  console.log(`commande à annuler → ${ref}`);
  await page.reload();
  await page.getByPlaceholder('Réf, code, marchand, ville…').fill(ref);
  const ligne = page.getByRole('row', { name: new RegExp(ref) });
  await expect(ligne.getByText('Nouvelle')).toBeVisible();
  await shotVp(page, 'TC-F12', '01-commande-nouvelle');

  await ligne.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Annuler' }).click();
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByPlaceholder('Réf, code, marchand, ville…').fill(ref);
  await expect(ligne.getByText('Annulée')).toBeVisible({ timeout: 15_000 });
  expect(sql(`SELECT status FROM tenant_rabatexpress.orders WHERE ref='${ref}'`)).toBe('ANNULEE');
  await shotVp(page, 'TC-F12', '02-commande-annulee');

  // Sur une commande annulée, les actions de cycle de vie ne sont plus proposées.
  await ligne.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Annuler' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Faire progresser' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Assigner un livreur' })).toBeDisabled();
  await shotVp(page, 'TC-F12', '03-actions-indisponibles');
  await page.keyboard.press('Escape');

  // Et l'API refuse une seconde annulation.
  const rejeu = await page.evaluate(async (r) => {
    const res = await fetch(`/api/orders/${encodeURIComponent(r)}/cancel`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, ref);
  console.log(`seconde annulation → ${rejeu.status} ${JSON.stringify(rejeu.body)}`);
  expect(rejeu.status).toBe(400);
});
