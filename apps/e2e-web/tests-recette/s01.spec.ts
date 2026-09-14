import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-S01 — Isolation stricte des données entre organisations.
// ATT : aucune donnée d'un tenant n'apparaît chez l'autre, sur AUCUNE page.
test('TC-S01 — deux organisations ne se voient pas', async ({ page }) => {
  test.setTimeout(300_000);
  const autre = 'tangerlog';

  // Une donnée bien identifiable chez le voisin.
  const marqueur = `TEMOIN-${Date.now().toString(36).toUpperCase()}`;
  sql(`INSERT INTO tenant_${autre}.drivers (name, city) VALUES ('${marqueur}', 'Tanger')`);
  const refVoisin = sql(`SELECT ref FROM tenant_${autre}.orders ORDER BY created_at DESC LIMIT 1`).trim();
  console.log(`  chez ${autre} → chauffeur ${marqueur}${refVoisin ? `, commande ${refVoisin}` : ''}`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  const pages = ['/dashboard', '/orders', '/drivers', '/vehicles', '/zones', '/tournees',
    '/returns', '/cash', '/payout', '/invoices', '/fleet', '/fraud', '/analytics', '/reviews', '/users'];
  for (const chemin of pages) {
    await page.goto(chemin);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(700);
    const corps = await page.locator('body').innerText();
    expect(corps, `${chemin} laisse fuir une donnée de ${autre}`).not.toContain(marqueur);
    if (refVoisin) expect(corps, `${chemin} laisse fuir ${refVoisin}`).not.toContain(refVoisin);
  }
  console.log(`  ${pages.length} pages parcourues : aucune donnée de ${autre}`);
  await shotVp(page, 'TC-S01', '01-cloisonnement');

  sql(`DELETE FROM tenant_${autre}.drivers WHERE name = '${marqueur}'`);
});
