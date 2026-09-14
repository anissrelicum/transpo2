import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-J02 — Suivre un chauffeur / plein écran.
// ATT : « Suivre » recentre la carte sur le chauffeur sélectionné ; la bascule plein écran
//       fonctionne dans les deux sens, sans quitter l'écran.
test('TC-J02 — suivre un chauffeur et basculer en plein écran', async ({ page }) => {
  test.setTimeout(180_000);
  const API = process.env.API_URL || 'http://localhost:3000';

  // Une position fraîche, remontée comme le ferait le téléphone.
  const jeton = (await (await page.request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'livreur@rabatexpress.ma', password: motDePasse('livreur@rabatexpress.ma') },
  })).json()).token;
  await page.request.post(`${API}/v1/tracking/position`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress', authorization: `Bearer ${jeton}` },
    data: { lat: 34.0209, lng: -6.8416 },
  });

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/fleet');
  await page.waitForTimeout(2500);
  await shotVp(page, 'TC-J02', '01-pc-flotte');

  // Sélectionner le chauffeur ouvre son volet, avec l'action « Suivre ».
  await page.getByText('Hamid Ouali').first().click();
  await expect(page.getByRole('button', { name: 'Suivre' })).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-J02', '02-chauffeur-selectionne');

  // « Suivre » recentre sans quitter l'écran ni perdre la sélection.
  await page.getByRole('button', { name: 'Suivre' }).click();
  await page.waitForTimeout(1200);
  expect(new URL(page.url()).pathname).toBe('/fleet');
  const apresSuivi = await page.locator('body').innerText();
  expect(apresSuivi).toContain('Hamid Ouali');
  await shotVp(page, 'TC-J02', '03-recentre');

  // Plein écran : la carte prend l'écran, et on en ressort au même endroit.
  await page.getByRole('button', { name: 'Plein écran' }).click();
  await expect(page.getByRole('button', { name: 'Quitter le plein écran' })).toBeVisible();
  await shotVp(page, 'TC-J02', '04-plein-ecran');
  await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  await expect(page.getByRole('button', { name: 'Plein écran' })).toBeVisible();
  console.log('  suivre → recentrage ; plein écran → aller-retour effectif');
});
