import { test, expect } from '@playwright/test';
import { loginTenant, logout, shotVp, motDePasse } from './helpers';

// TC-D10 — Disponibilité.
// PAS : basculer la disponibilité de Sara Bennis sur « indisponible » (accessible aussi au
//       dispatcher).
// ATT : bascule persistée ; un chauffeur indisponible ne doit plus être proposé par le
//       dispatch (vérifié en TC-F03).
test('TC-D10 — bascule de disponibilité, admin puis dispatcher', async ({ page }) => {
  test.setTimeout(150_000);
  const sara = () => page.getByRole('row', { name: /Sara Bennis/ });
  const bascule = () => sara().getByRole('switch');

  // 1. Administrateur : Sara passe indisponible.
  let err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/drivers');
  // Pré-requis (hors périmètre) : le cas part d'une Sara disponible, pour être rejouable.
  await page.evaluate(async () => {
    const r = await fetch('/api/proxy/v1/drivers');
    const ds = await r.json();
    const s = (Array.isArray(ds) ? ds : ds.items ?? []).find((d: any) => d.name === 'Sara Bennis');
    if (s && !s.available) {
      await fetch(`/api/proxy/v1/drivers/${s.id}/availability`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ available: true }),
      });
    }
  });
  await page.reload();
  await expect(bascule()).toBeChecked();
  await shotVp(page, 'TC-D10', '01-sara-disponible');
  await bascule().click();
  await expect(bascule()).not.toBeChecked({ timeout: 15_000 });

  // Persistance après rechargement, et compteur d'effectif à jour.
  await page.reload();
  await expect(bascule()).not.toBeChecked();
  await expect(page.getByText('2 chauffeurs · 1 disponibles · 0 non affectable(s)')).toBeVisible();
  await shotVp(page, 'TC-D10', '02-indisponible-persiste');

  // 2. Dispatcher : la bascule lui est ouverte (elle n'est pas réservée à l'admin).
  await logout(page, 'Nadia Alaoui');
  err = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', motDePasse('dispatch@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/drivers');
  await expect(bascule()).toBeEnabled();
  await expect(bascule()).not.toBeChecked();
  await shotVp(page, 'TC-D10', '03-dispatcher-bascule-ouverte');
  await bascule().click();
  await expect(bascule()).toBeChecked({ timeout: 15_000 });
  await page.reload();
  await expect(bascule()).toBeChecked();
  await shotVp(page, 'TC-D10', '04-dispatcher-a-rebascule');

  // 3. Le cas laisse Sara INDISPONIBLE : c'est l'état attendu par TC-F03, qui vérifie
  // qu'un chauffeur indisponible n'est plus proposé par le dispatch.
  await bascule().click();
  await expect(bascule()).not.toBeChecked({ timeout: 15_000 });
  await page.reload();
  await expect(bascule()).not.toBeChecked();
  await expect(page.getByText('2 chauffeurs · 1 disponibles · 0 non affectable(s)')).toBeVisible();
  await shotVp(page, 'TC-D10', '05-sara-indisponible-pour-F03');
});
