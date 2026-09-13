import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql } from './helpers';

// TC-E06 — Une zone ne peut pas devenir anonyme ni porter un livreur fantôme.
// PAS : vider le nom d'une zone et l'enregistrer ; puis, par appel direct, affecter à la
//       zone un livreur qui n'existe pas dans l'organisation.
// ATT : les deux sont refusés — une zone sans nom est introuvable dans la console, et un
//       livreur fantôme fausse le dispatch (qui affecte par NOM).
test('TC-E06 — nom vide et livreur inexistant refusés', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/zones');
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();

  // 1. Nom vidé puis enregistré.
  await page.getByLabel('Nom (français)').fill('');
  await shotVp(page, 'TC-E06', '01-nom-vide');
  const patch = page.waitForResponse(
    (r) => r.url().includes('/v1/dispatch/zones/') && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  const res = await patch;
  console.log(`PATCH zone nameFr="" → ${res.status()}`);
  expect(res.status()).toBe(400);
  await page.reload();
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();
  await shotVp(page, 'TC-E06', '02-nom-conserve');

  // 2. Livreur fantôme par appel direct.
  const fantome = await page.evaluate(async () => {
    const zs = await (await fetch('/api/proxy/v1/dispatch/zones')).json();
    const z = (Array.isArray(zs) ? zs : zs.items ?? [])[0];
    const r = await fetch(`/api/proxy/v1/dispatch/zones/${z.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ drivers: ['Fantôme Inexistant'] }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  console.log(`PATCH zone drivers=[fantôme] → ${fantome.status} ${JSON.stringify(fantome.body)}`);
  expect(fantome.status).toBe(400);
  const enBase = sql(`SELECT drivers FROM tenant_rabatexpress.zones WHERE name_fr='Rabat Centre'`);
  console.log(`livreurs en base → ${enBase}`);
  expect(enBase).not.toContain('Fantôme');
  await shotVp(page, 'TC-E06', '03-livreur-fantome-refuse');
});
