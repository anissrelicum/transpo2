import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-D05 — Retirer un véhicule.
// PAS : créer un véhicule jetable, puis menu → Retirer → confirmer.
// ATT : suppression effective ; tenter de retirer un véhicule RATTACHÉ à un chauffeur doit
//       être refusé ou détacher proprement (consigner le comportement observé).
// Le second volet est destructif pour le jeu de données §0.4 : 1111-A-11 est recréé et
// rerattaché à Hamid Ouali en fin de cas.
test('TC-D05 — retrait d’un véhicule jetable, puis d’un véhicule rattaché', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();

  async function ajouter(plaque: string) {
    await page.goto('/vehicles');
    await page.getByRole('button', { name: 'Ajouter un véhicule' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByPlaceholder('1234-A-56').fill(plaque);
    await dlg.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Rabat' }).click();
    await dlg.locator('input[type="date"]').nth(0).fill('2029-01-01');
    await dlg.locator('input[type="date"]').nth(1).fill('2029-01-01');
    await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByRole('row', { name: new RegExp(plaque) })).toBeVisible({ timeout: 15_000 });
  }

  async function retirer(plaque: string) {
    const row = page.getByRole('row', { name: new RegExp(plaque) });
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'Retirer' }).click();
    const alerte = page.getByRole('alertdialog');
    await expect(alerte.getByRole('heading', { name: `Retirer ${plaque} ?` })).toBeVisible();
    await alerte.getByRole('button', { name: 'Retirer' }).click();
  }

  // 1. Véhicule jetable : création puis retrait effectif.
  await ajouter('9999-Z-99');
  await shotVp(page, 'TC-D05', '01-vehicule-jetable-cree');
  await retirer('9999-Z-99');
  await page.reload();
  await expect(page.getByRole('row', { name: /9999-Z-99/ })).toHaveCount(0);
  await shotVp(page, 'TC-D05', '02-jetable-retire');

  // 2. Véhicule RATTACHÉ : le plan attend « refusé OU détaché proprement ».
  // Le cas se fabrique son propre porteur pour rester indépendant de l'ordre des cas
  // (l'effectif n'existe qu'à partir de TC-D06). Le détail du message est couvert par TC-D17.
  await page.goto('/drivers');
  const porteur = await page.evaluate(async () => {
    const j = { 'content-type': 'application/json' };
    const vs = await (await fetch('/api/proxy/v1/vehicles')).json();
    const v = (Array.isArray(vs) ? vs : vs.items ?? []).find((x: any) => x.plate === '1111-A-11');
    const ds = await (await fetch('/api/proxy/v1/drivers')).json();
    let d = (Array.isArray(ds) ? ds : ds.items ?? []).find((x: any) => x.name === 'Porteur Jetable');
    if (!d) {
      d = await (await fetch('/api/proxy/v1/drivers', {
        method: 'POST', headers: j, body: JSON.stringify({ name: 'Porteur Jetable', city: 'Rabat' }),
      })).json();
    }
    await fetch(`/api/proxy/v1/drivers/${d.id}/vehicle`, {
      method: 'PATCH', headers: j, body: JSON.stringify({ vehicleId: v.id }),
    });
    return d.id as string;
  });
  await page.reload();
  await expect(page.getByRole('row', { name: /Porteur Jetable/ }).getByText('1111-A-11')).toBeVisible();
  await shotVp(page, 'TC-D05', '03-vehicule-rattache-a-un-chauffeur');

  const message = new Promise<string>((resolve) => {
    page.once('dialog', async (d) => { const m = d.message(); await d.accept(); resolve(m); });
  });
  await page.goto('/vehicles');
  const supprime = page.waitForResponse(
    (r) => r.url().includes('/v1/vehicles/') && r.request().method() === 'DELETE',
  );
  await retirer('1111-A-11');
  const res = await supprime;
  console.log(`DELETE /v1/vehicles/<1111-A-11 rattaché> → ${res.status()} · « ${await message} »`);
  expect(res.status()).toBe(400);
  await shotVp(page, 'TC-D05', '04-retrait-refuse');

  // Ni suppression, ni détachement silencieux : parc et fiche intacts.
  await page.reload();
  await expect(page.getByRole('row', { name: /1111-A-11/ })).toHaveCount(1);
  await page.goto('/drivers');
  await expect(page.getByRole('row', { name: /Porteur Jetable/ }).getByText('1111-A-11')).toBeVisible();
  await shotVp(page, 'TC-D05', '05-parc-et-fiche-intacts');

  // Nettoyage : le porteur jetable ne doit pas polluer la suite du run.
  await page.evaluate(async (id) => {
    await fetch(`/api/proxy/v1/drivers/${id}/vehicle`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicleId: null }),
    });
    await fetch(`/api/proxy/v1/drivers/${id}`, { method: 'DELETE' });
  }, porteur);
  await page.reload();
  await expect(page.getByRole('row', { name: /Porteur Jetable/ })).toHaveCount(0);
});
