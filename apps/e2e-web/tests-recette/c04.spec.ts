import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-C04 — Écriture réservée à l'admin.
// PAS : se connecter en dispatcher → /settings.
// ATT : consultation possible, Enregistrer absent/refusé (403 côté API).
test('TC-C04 — /settings en lecture seule pour le dispatcher', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', motDePasse('dispatch@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Identité légale' })).toBeVisible();

  // Consultation possible : valeurs visibles.
  await expect(page.getByText('Lecture seule — la modification des paramètres est réservée à l’administrateur.')).toBeVisible();
  await expect(page.getByPlaceholder('Casa Express SARL')).toHaveValue('Rabat Express SARL');
  // Aucun bouton d'enregistrement, champs désactivés.
  await expect(page.getByRole('button', { name: /Enregistrer|Enregistré/ })).toHaveCount(0);
  await expect(page.getByPlaceholder('Casa Express SARL')).toBeDisabled();
  await expect(page.locator('input[type="number"]').first()).toBeDisabled();
  await shotVp(page, 'TC-C04', '01-lecture-seule-dispatcher');

  // Appel API direct avec la session dispatcher → 403.
  const res = await page.evaluate(async () => {
    const r = await fetch('/api/proxy/v1/settings/company', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ legalName: 'Tentative Dispatcher SARL' }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  console.log(`POST /v1/settings/company (dispatcher) → ${res.status} ${JSON.stringify(res.body)}`);
  expect(res.status).toBe(403);

  // Rien n'a été modifié.
  await page.reload();
  await expect(page.getByPlaceholder('Casa Express SARL')).toHaveValue('Rabat Express SARL');
  await shotVp(page, 'TC-C04', '02-valeurs-inchangees');
});
