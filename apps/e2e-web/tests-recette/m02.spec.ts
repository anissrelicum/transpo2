import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp } from './helpers';

// TC-M02 — Simulateur de devis.
// ATT : le total TTC correspond à la grille ENREGISTRÉE (paliers + remise + TVA), pas à
//       un calcul d'écran indépendant.
test('TC-M02 — le devis simulé suit la grille enregistrée', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Simulateur de devis' })).toBeVisible({ timeout: 20_000 });

  const cfg = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/pricing/config')).json()));
  const distance = Number(/Distance : (\d+) km/.exec(await page.locator('body').innerText())?.[1] ?? 9);

  // Le prix attendu, calculé depuis la grille du serveur — jamais depuis l'écran.
  const palier = cfg.tiers.find((t: any) => distance >= t.from && (t.to == null || distance < t.to)) ?? cfg.tiers.at(-1);
  const base = palier.base != null ? palier.base : Math.round(palier.perKm * distance * 100) / 100;
  const remise = Math.round(base * (1 - cfg.discountRate) * 100) / 100;
  const tva = Math.round(remise * cfg.vatRate * 100) / 100;
  const ttcAttendu = Math.round((remise + tva) * 100) / 100;
  console.log(`  ${distance} km → base ${base}, remisé ${remise}, TVA ${tva}, TTC attendu ${ttcAttendu}`);

  const corps = await page.locator('body').innerText();
  const affiche = /Total TTC[\s\S]{0,40}?([\d   ]+,\d{2})\s*DH/.exec(corps)?.[1]?.replace(/[\s ]/g, '').replace(',', '.');
  console.log(`  TTC affiché → ${affiche}`);
  expect(Number(affiche)).toBeCloseTo(ttcAttendu, 2);
  await shotVp(page, 'TC-M02', '01-devis-conforme-a-la-grille');

  // Et le devis de l'API — celui qui facturera réellement — doit donner le MÊME prix.
  // Il rendait le tarif plein : la remise contractuelle du tenant, appliquée à l'écran,
  // n'était pas transmise au moteur. Un dispatcher annonçait 51,84 DH et la facture
  // en portait 57,60.
  const devis = await page.evaluate(async (d) => (await (await fetch('/api/proxy/v1/pricing/quote', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ distanceKm: d }),
  })).json()), distance);
  console.log(`  /pricing/quote → ${JSON.stringify(devis)}`);
  expect(devis.ttc, 'le devis de l’API doit valoir celui du simulateur').toBeCloseTo(ttcAttendu, 2);
  expect(devis.applied).toBe('remise');
});
