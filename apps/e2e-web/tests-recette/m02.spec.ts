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
  const apresRemise = Math.round(base * (1 - cfg.discountRate) * 100) / 100;
  const tva = Math.round(apresRemise * cfg.vatRate * 100) / 100;
  const ttcAttendu = Math.round((apresRemise + tva) * 100) / 100;
  console.log(`  ${distance} km → base ${base}, remisé ${apresRemise}, TVA ${tva}, TTC attendu ${ttcAttendu}`);

  const corps = await page.locator('body').innerText();
  const affiche = /Total TTC[\s\S]{0,40}?([\d   ]+,\d{2})\s*DH/.exec(corps)?.[1]?.replace(/[\s ]/g, '').replace(',', '.');
  console.log(`  TTC affiché → ${affiche}`);
  expect(Number(affiche)).toBeCloseTo(ttcAttendu, 2);
  await shotVp(page, 'TC-M02', '01-devis-conforme-a-la-grille');

  // Le moteur qui facture doit rendre le même prix POUR LE MÊME CAS. La remise est
  // contractuelle (cascade : prix fixe marchand > grille remisée > grille standard) :
  // on la passe explicitement, comme le ferait une course d'un marchand sous contrat.
  const remise = await page.evaluate(async ([d, taux]) => (await (await fetch('/api/proxy/v1/pricing/quote', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ distanceKm: d, discountRate: taux }),
  })).json()), [distance, cfg.discountRate] as const);
  console.log(`  /pricing/quote (remisé) → ${JSON.stringify(remise)}`);
  expect(remise.applied).toBe('remise');
  expect(remise.ttc, 'le devis remisé doit valoir celui du simulateur').toBeCloseTo(ttcAttendu, 2);

  // Sans contrat, c'est la grille standard — et l'écart avec l'affichage par défaut du
  // simulateur est exactement la remise. C'est ce que l'exploitant doit avoir en tête :
  // le grand « Total TTC » de l'écran est un prix REMISÉ tant que la case est cochée.
  const plein = await page.evaluate(async (d) => (await (await fetch('/api/proxy/v1/pricing/quote', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ distanceKm: d }),
  })).json()), distance);
  console.log(`  /pricing/quote (sans contrat) → ${JSON.stringify(plein)}`);
  expect(plein.applied).toBe('grille');
  expect(plein.ttc).toBeGreaterThan(remise.ttc);
});
