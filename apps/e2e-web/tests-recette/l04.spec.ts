import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-L04 — Export comptable.
// ATT : téléchargement d'un CSV `reconciliation-cash.csv` contenant les sessions affichées.
test('TC-L04 — export comptable des sessions de caisse', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/cash');
  await page.waitForTimeout(1500);
  await shotVp(page, 'TC-L04', '01-avant-export');

  const attendus = sql(`SELECT driver FROM tenant_rabatexpress.cash_sessions`)
    .split('\n').map((l) => l.trim()).filter(Boolean);

  const telechargement = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Export comptable' }).click();
  const fichier = await telechargement;
  console.log(`  fichier téléchargé → ${fichier.suggestedFilename()}`);
  expect(fichier.suggestedFilename()).toBe('reconciliation-cash.csv');

  const chemin = await fichier.path();
  const contenu = chemin ? require('node:fs').readFileSync(chemin, 'utf-8') : '';
  console.log(`  contenu → ${contenu.split('\n').length - 1} ligne(s)`);
  for (const d of attendus) expect(contenu).toContain(d);
  await shotVp(page, 'TC-L04', '02-export-fait');
});
