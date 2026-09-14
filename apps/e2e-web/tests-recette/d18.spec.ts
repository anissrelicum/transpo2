import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, isoPlus, motDePasse } from './helpers';

// TC-D18 — Renouvellement dans le passé (non-régression OBS-10).
// PAS : renouveler une échéance avec une date d'hier, côté chauffeur puis véhicule.
// ATT : champ borné au jour même, Enregistrer désactivé, et appel API direct refusé 400.
test('TC-D18 — une échéance ne se renouvelle pas dans le passé', async ({ page }) => {
  test.setTimeout(150_000);
  const hier = isoPlus(-1);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // 1. Chauffeur : le formulaire refuse la date, le bouton reste hors d'atteinte.
  await page.goto('/drivers');
  const sara = page.getByRole('row', { name: /Sara Bennis/ });
  await sara.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Renouveler la visite médicale' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('input[type="date"]')).toHaveAttribute('min', isoPlus(0));
  await dlg.locator('input[type="date"]').fill(hier);
  await expect(dlg.getByText('La nouvelle échéance doit être postérieure à aujourd’hui.')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  await shotVp(page, 'TC-D18', '01-chauffeur-date-passee-refusee');
  await page.keyboard.press('Escape');

  // 2. Et l'API tient la règle, sans passer par le formulaire.
  const resChauffeur = await page.evaluate(async (due) => {
    const ds = await (await fetch('/api/proxy/v1/drivers')).json();
    const s = (Array.isArray(ds) ? ds : ds.items ?? []).find((d: any) => d.name === 'Sara Bennis');
    const r = await fetch(`/api/proxy/v1/drivers/${s.id}/renew`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'medical', due }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, hier);
  console.log(`POST /v1/drivers/<id>/renew due=${hier} → ${resChauffeur.status} ${JSON.stringify(resChauffeur.body)}`);
  expect(resChauffeur.status).toBe(400);

  // 3. Même règle côté véhicule.
  await page.goto('/vehicles');
  const vehicule = page.getByRole('row', { name: /2222-B-22/ });
  await vehicule.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Renouveler l’assurance' }).click();
  const dlgV = page.getByRole('dialog');
  await dlgV.locator('input[type="date"]').fill(hier);
  await expect(dlgV.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  await shotVp(page, 'TC-D18', '02-vehicule-date-passee-refusee');
  await page.keyboard.press('Escape');

  const resVehicule = await page.evaluate(async (due) => {
    const vs = await (await fetch('/api/proxy/v1/vehicles')).json();
    const v = (Array.isArray(vs) ? vs : vs.items ?? []).find((x: any) => x.plate === '2222-B-22');
    const r = await fetch(`/api/proxy/v1/vehicles/${v.id}/renew`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'insurance', due }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, hier);
  console.log(`POST /v1/vehicles/<id>/renew due=${hier} → ${resVehicule.status} ${JSON.stringify(resVehicule.body)}`);
  expect(resVehicule.status).toBe(400);

  // 4. Une date future reste acceptée : la règle borne, elle ne bloque pas l'usage normal.
  await page.goto('/drivers');
  await sara.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Renouveler la visite médicale' }).click();
  await page.getByRole('dialog').locator('input[type="date"]').fill(isoPlus(365));
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await page.reload();
  await expect(sara.getByText(/Expiré/)).toHaveCount(0);
  await shotVp(page, 'TC-D18', '03-date-future-acceptee');
});
