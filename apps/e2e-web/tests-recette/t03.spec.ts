import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp } from './helpers';

// TC-T03 — Responsive.
// ATT : à 1024 px puis 768 px, AUCUN débordement horizontal de la page ; les tableaux
//       défilent dans leur propre conteneur.
test('TC-T03 — la console tient à 1024 et 768 px sans déborder', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  for (const largeur of [1024, 768]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    for (const chemin of ['/orders', '/dispatch', '/cash']) {
      await page.goto(chemin);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
      const debordement = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        corps: document.body.scrollWidth - document.body.clientWidth,
      }));
      console.log(`  ${largeur}px ${chemin} → débordement page ${debordement.page}px, corps ${debordement.corps}px`);
      await shotVp(page, 'TC-T03', `${largeur}-${chemin.slice(1)}`);
      expect(debordement.page, `${chemin} déborde à ${largeur}px`).toBeLessThanOrEqual(1);
    }
  }
});
