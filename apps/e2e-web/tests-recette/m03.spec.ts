import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp } from './helpers';

// TC-M03 — Export de la grille tarifaire.
// ATT : CSV `grille-tarifaire.csv` téléchargé, conforme aux paliers affichés.
test('TC-M03 — export CSV de la grille', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Simulateur de devis' })).toBeVisible({ timeout: 20_000 });

  const cfg = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/pricing/config')).json()));
  const telechargement = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Export grille' }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toBe('grille-tarifaire.csv');

  const chemin = await fichier.path();
  const contenu = chemin ? require('node:fs').readFileSync(chemin, 'utf-8') : '';
  console.log(`  CSV → ${contenu.split('\n').filter(Boolean).length} ligne(s) pour ${cfg.tiers.length} palier(s)`);
  expect(contenu.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(cfg.tiers.length);
  await shotVp(page, 'TC-M03', '01-export-grille');
});
