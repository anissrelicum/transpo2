import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql, livrerCommeLivreur } from './helpers';

// TC-Q01 — Génération d'un cas de fraude.
// ATT : un signal réel (écart de caisse, livraison hors zone) crée un cas avec son score
//       et son résumé ; le classement des chauffeurs est cohérent.
test('TC-Q01 — un écart de caisse ouvre un cas de fraude', async ({ page }) => {
  test.setTimeout(180_000);
  const jour = new Date().toISOString().slice(0, 10);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Décor posé par le cas : une caisse du jour NEUVE, alimentée par une livraison réelle,
  // puis mise en écart. Reprendre la session laissée par la section L rendait ce cas
  // dépendant de l'ordre d'exécution — il passait seul et tombait dans une passe complète.
  sql(`DELETE FROM tenant_rabatexpress.fraud_cases WHERE driver = 'Hamid Ouali'`);
  sql(`DELETE FROM tenant_rabatexpress.cash_movements WHERE session_id IN
       (SELECT id FROM tenant_rabatexpress.cash_sessions WHERE session_date = '${jour}')`);
  sql(`DELETE FROM tenant_rabatexpress.cash_sessions WHERE session_date = '${jour}'`);
  const livree = await livrerCommeLivreur(page, { cod: 400 });
  console.log(`  décor → livraison ${livree.ref} encaissée 400 DH`);
  const id = sql(`SELECT id FROM tenant_rabatexpress.cash_sessions
                  WHERE driver = 'Hamid Ouali' AND session_date = '${jour}'`).trim();
  expect(id, 'l’encaissement doit ouvrir une caisse').toBeTruthy();
  sql(`UPDATE tenant_rabatexpress.cash_sessions
       SET declared = theorique - 150, status = 'ECART', deposited = 0,
           reason = NULL, note = NULL WHERE id = '${id}'`);

  // L'écart est résolu côté comptabilité : le fait reste, et doit alimenter le risque.
  await page.goto('/cash');
  await page.locator('tr', { hasText: 'Hamid Ouali' }).last().click();
  await expect(page.getByText('COD théorique').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Résoudre l’écart de/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByText('Cash manquant — à retenir sur prime').click();
  await dlg.getByRole('button', { name: 'Valider la résolution' }).click();
  await page.waitForTimeout(2500);
  await shotVp(page, 'TC-Q01', '01-ecart-resolu');

  const cas = sql(`SELECT driver, signals, score, status, summary FROM tenant_rabatexpress.fraud_cases
                   WHERE driver = 'Hamid Ouali' ORDER BY created_at DESC LIMIT 1`)
    .split('|').map((x) => x.trim());
  console.log(`  cas de fraude → ${cas.join(' · ')}`);
  expect(cas[0]).toBe('Hamid Ouali');
  expect(cas[1]).toContain('ecart_cash');
  expect(Number(cas[2])).toBe(30);          // barème FRAUD_SIGNALS.ecart_cash
  expect(cas[3]).toBe('OUVERT');
  expect(cas[4]).toContain('Écart de caisse');

  // Et l'écran de fraude le montre, avec le classement des chauffeurs à risque.
  await page.goto('/fraud');
  await page.waitForTimeout(2000);
  const corps = await page.locator('body').innerText();
  expect(corps).toContain('Hamid Ouali');
  expect(corps).not.toContain('Aucun cas');
  await shotVp(page, 'TC-Q01', '02-cas-ouvert');

  const classement = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/fraud/leaderboard')).json()));
  console.log(`  classement → ${JSON.stringify(classement)}`);
  expect(classement.some((c: any) => c.driver === 'Hamid Ouali')).toBe(true);
});
