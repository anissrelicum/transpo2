import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-D13 — Immatriculation au format invalide.
// PAS : ajouter un véhicule de plaque `ABCD`.
// ATT : refus dans l'UI et par l'API (format marocain NNNN-L-NN).
test('TC-D13 — immatriculation au format invalide refusée (UI + API)', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/vehicles');
  const avant = await page.getByRole('row').count();

  await page.getByRole('button', { name: 'Ajouter un véhicule' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('1234-A-56').fill('ABCD');
  await shotVp(page, 'TC-D13', '01-plaque-invalide-saisie');
  // L'UI garde la main : le bouton d'ajout reste hors d'atteinte.
  await expect(dlg.getByRole('button', { name: 'Ajouter', exact: true })).toBeDisabled();

  // Défense côté API, sans passer par le formulaire.
  const res = await page.evaluate(async () => {
    const r = await fetch('/api/proxy/v1/vehicles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plate: 'ABCD', type: 'Fourgon' }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  console.log(`POST /v1/vehicles plate=ABCD → ${res.status} ${JSON.stringify(res.body)}`);
  expect(res.status).toBe(400);
  await shotVp(page, 'TC-D13', '02-api-refuse');

  await page.reload();
  expect(await page.getByRole('row').count()).toBe(avant);
});
