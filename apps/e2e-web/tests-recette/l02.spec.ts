import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-L02 — Enregistrer le dépôt en agence.
// ATT : statut Déposé, montant déposé = montant déclaré.
test('TC-L02 — dépôt en agence d’une caisse à déposer', async ({ page }) => {
  test.setTimeout(180_000);
  const jour = new Date().toISOString().slice(0, 10);

  // Décor : la caisse du jour est déclarée juste (le livreur a le compte exact).
  const id = sql(`SELECT id FROM tenant_rabatexpress.cash_sessions
                  WHERE driver = 'Hamid Ouali' AND session_date = '${jour}'`).trim();
  expect(id, 'une caisse du jour doit exister (TC-L01)').toBeTruthy();
  sql(`UPDATE tenant_rabatexpress.cash_sessions
       SET declared = theorique, status = 'A_DEPOSER', deposited = 0 WHERE id = '${id}'`);
  const theorique = sql(`SELECT theorique FROM tenant_rabatexpress.cash_sessions WHERE id = '${id}'`).trim();

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/cash');
  await page.getByText('Hamid Ouali').first().click();
  await page.waitForTimeout(1200);
  await shotVp(page, 'TC-L02', '01-a-deposer');

  await page.getByRole('button', { name: 'Enregistrer le dépôt en agence' }).click();
  await expect.poll(
    () => sql(`SELECT status FROM tenant_rabatexpress.cash_sessions WHERE id = '${id}'`).trim(),
    { timeout: 20_000 },
  ).toBe('DEPOSE');

  const depose = sql(`SELECT deposited FROM tenant_rabatexpress.cash_sessions WHERE id = '${id}'`).trim();
  console.log(`  déposé ${depose} DH pour un déclaré de ${theorique} DH`);
  expect(depose).toBe(theorique);
  await page.reload();
  await page.getByText('Hamid Ouali').first().click();
  await page.waitForTimeout(1200);
  await expect(page.getByText(/Session clôturée/)).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-L02', '02-depose');

  // Un second dépôt n'a pas de sens : l'API doit le refuser.
  const refus = await page.evaluate(async (sid) => {
    const r = await fetch(`/api/proxy/v1/cash/sessions/${sid}/deposit`, { method: 'POST' });
    return r.status;
  }, id);
  console.log(`  second dépôt → ${refus}`);
  expect(refus).toBe(400);
});
