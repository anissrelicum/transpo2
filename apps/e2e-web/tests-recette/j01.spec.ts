import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-J01 — Positions temps réel au PC flotte.
// PRÉ : l'app livreur a envoyé des positions (shift démarré, cf. TC-G13).
// ATT : le chauffeur apparaît avec sa dernière position et sa zone.
test('TC-J01 — le PC flotte montre la dernière position du livreur', async ({ page }) => {
  test.setTimeout(180_000);

  // L'app livreur remonte ses positions dès que le shift tourne (TC-G13). Si le dernier
  // point date d'un autre run, on en pose un frais par le MÊME chemin que le téléphone —
  // l'ingestion authentifiée en livreur, pas un INSERT.
  const mdpLivreur = motDePasse('livreur@rabatexpress.ma');
  const API = process.env.API_URL || 'http://localhost:3000';
  const jeton = await (await page.request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'livreur@rabatexpress.ma', password: mdpLivreur },
  })).json();
  await page.request.post(`${API}/v1/tracking/position`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress',
               authorization: `Bearer ${jeton.token}` },
    data: { lat: 34.0209, lng: -6.8416 },
  });

  const derniere = sql(`SELECT driver, lat, lng, at FROM tenant_rabatexpress.driver_positions
                        ORDER BY at DESC LIMIT 1`).split('|').map((x) => x.trim());
  console.log(`  dernière position en base → ${derniere.join(' · ')}`);
  expect(derniere[0], 'une position de livreur doit exister').toBeTruthy();

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/fleet');
  await page.waitForTimeout(2500);
  await shotVp(page, 'TC-J01', '01-pc-flotte');

  const corps = await page.locator('body').innerText();
  expect(corps).toContain(derniere[0]);

  // La position affichée est celle que le téléphone a envoyée, pas une position inventée.
  const live = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/tracking/live')).json()));
  const sien = live.find((l: any) => l.driver === derniere[0]);
  console.log(`  /tracking/live → ${JSON.stringify(sien)}`);
  expect(sien).toBeTruthy();
  expect(Number(sien.lat).toFixed(3)).toBe(Number(derniere[1]).toFixed(3));
  expect(Number(sien.lng).toFixed(3)).toBe(Number(derniere[2]).toFixed(3));
  await shotVp(page, 'TC-J01', '02-position-du-livreur');
});
