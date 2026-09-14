import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-M07 — Export CSV des factures.
// ATT : `factures.csv` téléchargé, conforme à ce que l'écran affiche.
test('TC-M07 — export CSV des factures', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  const factures = sql(`SELECT ref, merchant FROM tenant_rabatexpress.invoices`)
    .split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((c) => c[0]);
  console.log(`  ${factures.length} facture(s) en base`);
  expect(factures.length, 'une facture doit exister (TC-M04)').toBeGreaterThan(0);

  await page.goto('/invoices');
  await page.waitForTimeout(2000);
  await shotVp(page, 'TC-M07', '01-factures');

  const telechargement = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toBe('factures.csv');

  const chemin = await fichier.path();
  const contenu = chemin ? require('node:fs').readFileSync(chemin, 'utf-8') : '';
  console.log(`  CSV → ${contenu.split('\n').filter(Boolean).length} ligne(s)`);
  // Chaque facture affichée doit se retrouver dans l'export : un export incomplet est pire
  // qu'une absence d'export, la comptabilité s'y fierait.
  for (const [ref] of factures) expect(contenu, `${ref} absente de l'export`).toContain(ref);
  await shotVp(page, 'TC-M07', '02-export-fait');
});
