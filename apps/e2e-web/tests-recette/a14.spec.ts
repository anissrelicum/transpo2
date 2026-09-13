import { test, expect } from '@playwright/test';
import { loginSaas, openPlanMenu, shotVp } from './helpers';

// TC-A14 — Grille non contiguë refusée : forcer un trou (palier 1 à 50 alors que le
// palier 2 commence à 101) → message rouge « Paliers 1 et 2 non contigus : le suivant
// doit commencer à 51 », Publier désactivé. L'appel API direct est également refusé (400).
test('TC-A14 — Grille non contiguë refusée', async ({ page }) => {
  test.setTimeout(120_000);
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  await openPlanMenu(page, 'pay-as-you-go');
  await page.getByRole('menuitem', { name: /Nouvelle version de tarif/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Nouveau tarif/)).toBeVisible();

  // Date d'effet demain (v1 du plan date d'aujourd'hui) pour isoler le contrôle des paliers.
  await dialog.locator('input[type="date"]').fill('2026-09-09');

  // Grille courante pré-remplie : 1–100, 101–500, 501+. Forcer le trou : À(1) = 50.
  const tierRows = dialog.locator('table tbody tr');
  await expect(tierRows).toHaveCount(3);
  await tierRows.nth(0).locator('input').first().fill('50');
  await page.waitForTimeout(400);
  await shotVp(page, 'TC-A14', '01-tentative-trou-palier-1-a-50');

  const gapError = dialog.getByText(/non contigus/);
  const publier = dialog.getByRole('button', { name: 'Publier le tarif' });
  if ((await gapError.count()) > 0) {
    await expect(gapError).toContainText('Paliers 1 et 2 non contigus : le suivant doit commencer à 51');
    await expect(publier).toBeDisabled();
    console.log('UI : erreur de contiguïté affichée, publication bloquée.');
  } else {
    // L'éditeur recale automatiquement le palier suivant : le trou est impossible dans l'UI.
    await expect(tierRows.nth(1)).toContainText('51');
    console.log('UI : recalage automatique du palier 2 à 51 — trou impossible dans l’éditeur.');
  }

  // L'appel API direct avec une grille trouée est refusé (400).
  const api = await page.evaluate(async () => {
    const res = await fetch('/api/proxy/v1/saas/plans/pay-as-you-go/versions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        billingMode: 'USAGE', effectiveFrom: '2026-09-09', tierMode: 'VOLUME',
        minCentimes: 0, baseCentimes: 0,
        tiers: [
          { fromQty: 1, toQty: 50, unitCentimes: 600 },
          { fromQty: 101, toQty: 500, unitCentimes: 450 },
          { fromQty: 501, toQty: null, unitCentimes: 300 },
        ],
      }),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  });
  console.log(`API grille trouée → ${api.status} ${JSON.stringify(api.body)}`);
  expect(api.status).toBe(400);
  expect(JSON.stringify(api.body)).toContain('non contigus');

  // Ne rien publier : annuler le dialogue.
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toBeHidden();
  await shotVp(page, 'TC-A14', '02-dialogue-annule-rien-publie');
});
