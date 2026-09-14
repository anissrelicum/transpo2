import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-D17 — Retrait d'un véhicule rattaché (non-régression AN-15).
// PAS : menu de 1111-A-11 (rattaché à Hamid Ouali) → Retirer → confirmer.
// ATT : refus explicite NOMMANT le chauffeur ; véhicule toujours au parc, fiche intacte.
test('TC-D17 — retrait d’un véhicule rattaché refusé, chauffeur nommé', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/drivers');

  // Pré-requis : 1111-A-11 rattaché à Hamid Ouali.
  await page.evaluate(async () => {
    const ds = await (await fetch('/api/proxy/v1/drivers')).json();
    const h = (Array.isArray(ds) ? ds : ds.items ?? []).find((d: any) => d.name === 'Hamid Ouali');
    if (h?.vehiclePlate !== '1111-A-11') {
      const vs = await (await fetch('/api/proxy/v1/vehicles')).json();
      const v = (Array.isArray(vs) ? vs : vs.items ?? []).find((x: any) => x.plate === '1111-A-11');
      await fetch(`/api/proxy/v1/drivers/${h.id}/vehicle`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vehicleId: v.id }),
      });
    }
  });
  await page.reload();
  await expect(page.getByRole('row', { name: /Hamid Ouali/ }).getByText('1111-A-11')).toBeVisible();
  await shotVp(page, 'TC-D17', '01-vehicule-rattache');

  // Message d'alerte du navigateur capté avant le clic (le refus API passe par alert()).
  const message = new Promise<string>((resolve) => {
    page.once('dialog', async (d) => { const m = d.message(); await d.accept(); resolve(m); });
  });
  await page.goto('/vehicles');
  const ligne = page.getByRole('row', { name: /1111-A-11/ });
  await ligne.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Retirer' }).click();
  const alerte = page.getByRole('alertdialog');
  await expect(alerte.getByRole('heading', { name: 'Retirer 1111-A-11 ?' })).toBeVisible();
  const refus = page.waitForResponse(
    (r) => r.url().includes('/v1/vehicles/') && r.request().method() === 'DELETE',
  );
  await alerte.getByRole('button', { name: 'Retirer' }).click();
  const res = await refus;
  const texte = await message;
  console.log(`DELETE /v1/vehicles (rattaché) → ${res.status()} · message « ${texte} »`);
  expect(res.status()).toBe(400);
  expect(texte).toContain('Hamid Ouali');
  await shotVp(page, 'TC-D17', '02-refus-nomme-le-chauffeur');

  // Le véhicule est toujours au parc et la fiche chauffeur intacte.
  await page.reload();
  await expect(page.getByRole('row', { name: /1111-A-11/ })).toHaveCount(1);
  await page.goto('/drivers');
  await expect(page.getByRole('row', { name: /Hamid Ouali/ }).getByText('1111-A-11')).toBeVisible();
  await shotVp(page, 'TC-D17', '03-parc-et-fiche-intacts');
});
