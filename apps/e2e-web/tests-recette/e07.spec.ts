import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-E07 — Un polygone de moins de trois sommets n'en est pas un.
// PAS : tracer deux sommets et enregistrer sans effacer ; puis forcer par appel direct.
// ATT : refus — une zone à deux sommets ne délimite rien, n'est pas rendue sur la carte
//       et rendrait tout géofencing muet.
test('TC-E07 — polygone à moins de trois sommets refusé', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/zones');
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();
  const avant = sql(`SELECT json_array_length(polygon::json) FROM tenant_rabatexpress.zones WHERE name_fr='Rabat Centre'`);

  await page.getByRole('button', { name: 'Dessiner un polygone' }).click();
  const b = (await page.locator('.leaflet-container').boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.35, b.y + b.height * 0.35);
  await page.waitForTimeout(250);
  await page.mouse.click(b.x + b.width * 0.65, b.y + b.height * 0.35);
  await page.waitForTimeout(250);
  await shotVp(page, 'TC-E07', '01-deux-sommets');

  const patch = page.waitForResponse(
    (r) => r.url().includes('/v1/dispatch/zones/') && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  const res = await patch;
  console.log(`PATCH polygone à 2 sommets → ${res.status()}`);
  expect(res.status()).toBe(400);
  await shotVp(page, 'TC-E07', '02-refus');

  // Le tracé enregistré n'a pas bougé.
  await page.reload();
  const apres = sql(`SELECT json_array_length(polygon::json) FROM tenant_rabatexpress.zones WHERE name_fr='Rabat Centre'`);
  console.log(`sommets enregistrés : avant ${avant} → après ${apres}`);
  expect(apres).toBe(avant);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
  await shotVp(page, 'TC-E07', '03-trace-intact');
});
