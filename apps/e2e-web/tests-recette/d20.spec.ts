import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-D20 — Écriture flotte réservée à l'admin.
// PAS : se connecter en dispatcher → /vehicles puis /drivers.
// ATT : consultation possible ; Ajouter / Retirer / Renouveler / Rattacher / Modifier
//       absents ou désactivés, et les appels API refusés 403. Seule la bascule de
//       disponibilité reste ouverte au dispatcher (TC-D10).
test('TC-D20 — flotte en lecture seule pour le dispatcher (UI + API)', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', motDePasse('dispatch@rabatexpress.ma'));
  expect(err).toBeNull();

  // 1. /vehicles : la liste se consulte, aucune action d'écriture n'est offerte.
  await page.goto('/vehicles');
  await expect(page.getByRole('row', { name: /1111-A-11/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un véhicule' })).toHaveCount(0);
  await shotVp(page, 'TC-D20', '01-vehicules-lecture-seule');

  // 2. /drivers : idem, sauf la bascule de disponibilité qui lui revient.
  await page.goto('/drivers');
  const sara = page.getByRole('row', { name: /Sara Bennis/ });
  await expect(sara).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un chauffeur' })).toHaveCount(0);
  await expect(sara.getByRole('switch')).toBeEnabled();
  await shotVp(page, 'TC-D20', '02-chauffeurs-lecture-seule-sauf-dispo');

  // 3. Chaque écriture appelée directement est refusée 403.
  const refus = await page.evaluate(async () => {
    const ds = await (await fetch('/api/proxy/v1/drivers')).json();
    const d = (Array.isArray(ds) ? ds : ds.items ?? [])[0];
    const vs = await (await fetch('/api/proxy/v1/vehicles')).json();
    const v = (Array.isArray(vs) ? vs : vs.items ?? [])[0];
    const j = { 'content-type': 'application/json' };
    const appels: [string, Promise<Response>][] = [
      ['POST /v1/vehicles', fetch('/api/proxy/v1/vehicles', { method: 'POST', headers: j, body: JSON.stringify({ plate: '7777-Z-77', type: 'Moto' }) })],
      ['DELETE /v1/vehicles/:id', fetch(`/api/proxy/v1/vehicles/${v.id}`, { method: 'DELETE' })],
      ['POST /v1/vehicles/:id/renew', fetch(`/api/proxy/v1/vehicles/${v.id}/renew`, { method: 'POST', headers: j, body: JSON.stringify({ field: 'ct', due: '2030-01-01' }) })],
      ['POST /v1/drivers', fetch('/api/proxy/v1/drivers', { method: 'POST', headers: j, body: JSON.stringify({ name: 'Intrus Dispatcher' }) })],
      ['PATCH /v1/drivers/:id', fetch(`/api/proxy/v1/drivers/${d.id}`, { method: 'PATCH', headers: j, body: JSON.stringify({ city: 'Tanger' }) })],
      ['PATCH /v1/drivers/:id/vehicle', fetch(`/api/proxy/v1/drivers/${d.id}/vehicle`, { method: 'PATCH', headers: j, body: JSON.stringify({ vehicleId: null }) })],
      ['DELETE /v1/drivers/:id', fetch(`/api/proxy/v1/drivers/${d.id}`, { method: 'DELETE' })],
    ];
    const out: Record<string, number> = {};
    for (const [nom, p] of appels) out[nom] = (await p).status;
    return out;
  });
  console.log(`ÉCRITURES DISPATCHER → ${JSON.stringify(refus, null, 0)}`);
  for (const [route, code] of Object.entries(refus)) expect(code, route).toBe(403);
  await shotVp(page, 'TC-D20', '03-api-403-sur-toutes-les-ecritures');

  // 4. Rien n'a bougé : parc et effectif intacts.
  await page.goto('/vehicles');
  await expect(page.getByRole('row', { name: /7777-Z-77/ })).toHaveCount(0);
  await page.goto('/drivers');
  await expect(page.getByRole('row', { name: /Intrus Dispatcher/ })).toHaveCount(0);
  await shotVp(page, 'TC-D20', '04-rien-modifie');
});
