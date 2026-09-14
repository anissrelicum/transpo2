import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-T05 — Cohérence des statuts.
// ATT : un même statut porte le même libellé partout — console, API, suivi client.
test('TC-T05 — un statut se dit pareil partout', async ({ page, request }) => {
  test.setTimeout(180_000);
  const API = process.env.API_URL || 'http://localhost:3000';

  const ligne = sql(`SELECT ref, code, status FROM tenant_rabatexpress.orders
                     WHERE status NOT IN ('ANNULEE') ORDER BY created_at DESC LIMIT 1`)
    .split('|').map((x) => x.trim());
  const [ref, code, statut] = ligne;
  console.log(`  commande témoin → ${ref} (${code}) au statut ${statut}`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Le libellé de référence, celui du domaine, servi au suivi public.
  const suivi = await (await request.get(`${API}/v1/public/track/rabatexpress/${code}`)).json();
  const libelle = suivi.statusLabel;
  console.log(`  libellé de référence → « ${libelle} »`);

  // La liste des commandes et la fiche doivent employer le même mot.
  await page.goto(`/orders?q=${ref}`);
  await page.waitForTimeout(2000);
  const liste = await page.locator('body').innerText();
  expect(liste).toContain(libelle);
  await shotVp(page, 'TC-T05', '01-liste');

  await page.goto(`/orders/${ref}`);
  await page.waitForTimeout(2000);
  const fiche = await page.locator('body').innerText();
  expect(fiche).toContain(libelle);
  await shotVp(page, 'TC-T05', '02-fiche');
  console.log('  même libellé sur la liste, la fiche et le suivi client');
});
