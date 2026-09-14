import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql, creerCommandes } from './helpers';

// TC-H01 — Scanner une entrée au hub.
// PRÉ : au moins 3 commandes au statut Récupérée.
// ATT : le colis entre dans la colonne « Arrivés — à scanner » et les indicateurs suivent.
test('TC-H01 — enregistrer l’entrée d’un colis au hub', async ({ page }) => {
  test.setTimeout(180_000);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Décor posé par le cas lui-même : trois colis récupérés, hub vidé.
  sql(`UPDATE tenant_rabatexpress.orders SET hub_phase = NULL`);
  const refs = await creerCommandes(page, [
    { cod: 120, toCity: 'Casablanca' }, { cod: 120, toCity: 'Casablanca' }, { cod: 120, toCity: 'Casablanca' },
  ]);
  sql(`UPDATE tenant_rabatexpress.orders SET status = 'RECUPEREE'
       WHERE ref IN (${refs.map((r) => `'${r}'`).join(',')})`);
  const codes = refs.map((r) =>
    sql(`SELECT code FROM tenant_rabatexpress.orders WHERE ref = '${r}'`).trim());
  console.log(`  décor → ${codes.join(', ')}`);

  await page.goto('/hub');
  await expect(page.getByRole('heading', { name: 'Tri en hub' })).toBeVisible();
  await shotVp(page, 'TC-H01', '01-hub-vide');

  // État de départ : le hub est vide, les indicateurs à zéro.
  const kpi = (label: string) => page.locator('div').filter({ hasText: new RegExp(`^${label}`) }).first();
  await expect(page.getByText('Colis dans le hub')).toBeVisible();
  const avant = await page.locator('body').innerText();
  expect(avant).toContain('Arrivés — à scanner');

  // Le badge « Prêt » n'apparaît qu'à 8 caractères : c'est le signal que le code est complet.
  const champ = page.getByPlaceholder(/Scanner ou saisir un code colis/);
  await champ.fill(codes[0]);
  await expect(page.getByText('Prêt')).toBeVisible();
  await shotVp(page, 'TC-H01', '02-code-pret');

  await page.getByRole('button', { name: 'Enregistrer l’entrée' }).click();

  // Le colis rejoint « Arrivés — à scanner » : il est entré, il n'est pas encore trié.
  const colonneArrives = page.locator('div').filter({ hasText: /^Arrivés — à scanner/ }).first();
  await expect(colonneArrives.getByText(codes[0])).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-H01', '03-colis-arrive');

  // Les indicateurs suivent : 1 colis dans le hub, 1 à scanner.
  const corps = await page.locator('body').innerText();
  expect(corps).toMatch(/Colis dans le hub[\s\S]{0,40}\b1\b/);
  expect(corps).toMatch(/À scanner[\s\S]{0,40}\b1\b/);

  // Et en base, la phase posée est bien l'entrée — pas le tri.
  const phase = sql(`SELECT hub_phase FROM tenant_rabatexpress.orders WHERE code = '${codes[0]}'`);
  expect(phase.trim(), 'le scan d’entrée doit poser la phase « arrive »').toBe('arrive');

  // Le champ se vide, prêt pour le colis suivant : un agent en enchaîne des dizaines.
  await expect(champ).toHaveValue('');
  await champ.fill(codes[1]);
  await page.getByRole('button', { name: 'Enregistrer l’entrée' }).click();
  await expect(colonneArrives.getByText(codes[1])).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-H01', '04-deux-colis-arrives');
  expect((await page.locator('body').innerText())).toMatch(/À scanner[\s\S]{0,40}\b2\b/);
});
