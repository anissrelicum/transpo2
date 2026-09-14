import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-D16 — Véhicule déjà rattaché à un autre chauffeur.
// PAS : rattacher 1111-A-11 (déjà sur Hamid Ouali) à Sara Bennis.
// ATT : le sélecteur annonce « déjà sur Hamid Ouali » et un avertissement s'affiche AVANT
//       validation. Le partage n'est pas interdit — il ne doit pas se découvrir après coup.
test('TC-D16 — un véhicule déjà rattaché est annoncé avant validation', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/drivers');

  // Pré-requis : 1111-A-11 rattaché à Hamid Ouali, Sara sans véhicule.
  await page.evaluate(async () => {
    const ds = await (await fetch('/api/proxy/v1/drivers')).json();
    const liste = Array.isArray(ds) ? ds : ds.items ?? [];
    const vs = await (await fetch('/api/proxy/v1/vehicles')).json();
    const v = (Array.isArray(vs) ? vs : vs.items ?? []).find((x: any) => x.plate === '1111-A-11');
    const set = (id: string, vehicleId: string | null) => fetch(`/api/proxy/v1/drivers/${id}/vehicle`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vehicleId }),
    });
    for (const d of liste) {
      if (d.name === 'Hamid Ouali') await set(d.id, v.id);
      else if (d.vehicleId) await set(d.id, null);
    }
  });
  await page.reload();
  await expect(page.getByRole('row', { name: /Hamid Ouali/ }).getByText('1111-A-11')).toBeVisible();

  const sara = page.getByRole('row', { name: /Sara Bennis/ });
  await sara.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Rattacher un véhicule' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').click();
  // L'option porte le nom du chauffeur qui détient déjà le véhicule.
  await expect(page.getByRole('option', { name: /1111-A-11.*déjà sur Hamid Ouali/ })).toBeVisible();
  await shotVp(page, 'TC-D16', '01-option-annonce-le-porteur');
  await page.getByRole('option', { name: /1111-A-11/ }).click();
  // Et l'avertissement s'affiche AVANT de valider.
  await expect(dlg.getByText(/déjà rattaché à Hamid Ouali/)).toBeVisible();
  await shotVp(page, 'TC-D16', '02-avertissement-avant-validation');

  // On renonce : rien n'est modifié.
  await dlg.getByRole('button', { name: 'Annuler' }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('row', { name: /Hamid Ouali/ }).getByText('1111-A-11')).toBeVisible();
  await expect(sara.getByText('1111-A-11')).toHaveCount(0);
  await shotVp(page, 'TC-D16', '03-rien-modifie');
});
