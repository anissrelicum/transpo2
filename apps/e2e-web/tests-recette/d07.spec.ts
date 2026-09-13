import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-D07 — Téléphone invalide.
// PAS : créer un chauffeur avec le téléphone « abc ».
// ATT : refus « Téléphone invalide. ».
test('TC-D07 — téléphone invalide refusé (UI + API)', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/drivers');

  // UI : le formulaire bloque la saisie invalide (champ rouge, Ajouter désactivé).
  await page.getByRole('button', { name: 'Ajouter un chauffeur' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Youssef Benali').fill('Test Telephone');
  await dlg.getByPlaceholder('+212600000000').fill('abc');
  await expect(dlg.getByText('Numéro invalide.')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Ajouter', exact: true })).toBeDisabled();
  await shotVp(page, 'TC-D07', '01-telephone-invalide-ui');

  // API directe : le message « Téléphone invalide. » est bien celui du refus serveur.
  const res = await page.evaluate(async () => {
    const r = await fetch('/api/proxy/v1/drivers', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test Telephone', phone: 'abc' }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  console.log(`POST /v1/drivers phone=abc → ${res.status} ${JSON.stringify(res.body)}`);
  expect(res.status).toBe(400);
  expect(JSON.stringify(res.body)).toContain('Téléphone invalide');

  // Rien de créé : toujours 2 chauffeurs.
  await dlg.getByRole('button', { name: 'Annuler' }).click();
  await page.reload();
  await expect(page.getByText(/2 chauffeurs ·/)).toBeVisible();
  await expect(page.getByRole('row', { name: /Test Telephone/ })).toHaveCount(0);
  await shotVp(page, 'TC-D07', '02-rien-de-cree');
});
