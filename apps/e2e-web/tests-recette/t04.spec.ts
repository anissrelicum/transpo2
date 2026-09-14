import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-T04 — États vides.
// ATT : sur un tenant fraîchement provisionné, AUCUNE page ne plante et chaque liste vide
//       affiche un message dédié — jamais un écran blanc.
test('TC-T04 — un tenant neuf ne rend aucun écran blanc', async ({ page }) => {
  test.setTimeout(300_000);

  // Un tenant neuf, sans aucune donnée d'exploitation.
  const slug = 'tangerlog';
  const existe = sql(`SELECT count(*) FROM platform.tenants WHERE slug = '${slug}'`).trim();
  expect(existe, 'le tenant de test doit exister').not.toBe('0');
  const email = `admin@${slug}.ma`;

  const err = await loginTenant(page, slug, email, motDePasse(email));
  expect(err).toBeNull();

  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));

  const pages = ['/dashboard', '/orders', '/dispatch', '/drivers', '/vehicles', '/zones',
    '/tournees', '/hub', '/returns', '/cash', '/payout', '/pricing', '/invoices',
    '/fleet', '/fraud', '/analytics', '/notifications', '/templates', '/reviews', '/users', '/settings'];

  for (const chemin of pages) {
    await page.goto(chemin);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(900);
    const texte = (await page.locator('body').innerText()).trim();
    const vide = texte.length < 40;
    const plante = /Application error|Unhandled|TypeError|Internal Server Error/i.test(texte);
    console.log(`  ${chemin.padEnd(16)} → ${texte.length} car.${vide ? ' ⚠ ÉCRAN QUASI VIDE' : ''}${plante ? ' ⚠ ERREUR' : ''}`);
    expect(plante, `${chemin} affiche une erreur`).toBe(false);
    expect(vide, `${chemin} est vide`).toBe(false);
  }
  await shotVp(page, 'TC-T04', '01-tenant-neuf');
  console.log(`  erreurs JavaScript relevées : ${erreurs.length}`);
  expect(erreurs, `erreurs JS : ${erreurs.join(' | ')}`).toHaveLength(0);
});
