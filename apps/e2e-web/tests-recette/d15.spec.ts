import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-D15 — Un véhicule non actif n'est pas rattachable.
// PAS : passer 1111-A-11 en maintenance, puis ouvrir « Rattacher un véhicule ».
// ATT : le véhicule n'est pas proposé ; forcé par appel direct, l'API refuse 400.
test('TC-D15 — véhicule en maintenance non rattachable (UI + API)', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();

  // Pré-requis : Sara Bennis sans véhicule, 1111-A-11 actif et détaché de tout le monde.
  await page.goto('/drivers');
  const idVehicule = await page.evaluate(async () => {
    const ds = await (await fetch('/api/proxy/v1/drivers')).json();
    for (const d of (Array.isArray(ds) ? ds : ds.items ?? [])) {
      if (d.vehicleId) {
        await fetch(`/api/proxy/v1/drivers/${d.id}/vehicle`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ vehicleId: null }),
        });
      }
    }
    const vs = await (await fetch('/api/proxy/v1/vehicles')).json();
    return (Array.isArray(vs) ? vs : vs.items ?? []).find((v: any) => v.plate === '1111-A-11')?.id ?? '';
  });
  expect(idVehicule).not.toBe('');

  // 1. Mise en maintenance depuis la liste des véhicules.
  await page.goto('/vehicles');
  const ligne = page.getByRole('row', { name: /1111-A-11/ });
  await ligne.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Mettre en maintenance' }).click();
  await expect(ligne.getByText('Maintenance', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-D15', '01-vehicule-en-maintenance');

  // 2. Il disparaît des options de rattachement.
  await page.goto('/drivers');
  const sara = page.getByRole('row', { name: /Sara Bennis/ });
  await sara.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Rattacher un véhicule' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').click();
  await expect(page.getByRole('option', { name: /1111-A-11/ })).toHaveCount(0);
  await shotVp(page, 'TC-D15', '02-absent-des-options');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // 3. Forcé par appel direct : l'API tient la règle.
  const res = await page.evaluate(async (vid) => {
    const ds = await (await fetch('/api/proxy/v1/drivers')).json();
    const s = (Array.isArray(ds) ? ds : ds.items ?? []).find((d: any) => d.name === 'Sara Bennis');
    const r = await fetch(`/api/proxy/v1/drivers/${s.id}/vehicle`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicleId: vid }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, idVehicule);
  console.log(`PATCH .../vehicle sur véhicule en maintenance → ${res.status} ${JSON.stringify(res.body)}`);
  expect(res.status).toBe(400);
  await shotVp(page, 'TC-D15', '03-api-refuse');

  // 4. Remise en état : véhicule réactivé pour la suite du run.
  await page.goto('/vehicles');
  await ligne.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Réactiver' }).click();
  await expect(ligne.getByText('Actif', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-D15', '04-vehicule-reactive');
});
