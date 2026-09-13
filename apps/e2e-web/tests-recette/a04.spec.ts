import { test, expect } from '@playwright/test';
import { loginSaas, nextAlert, shot, nbTenants } from './helpers';

// TC-A04 — Slug réservé refusé : api, www, admin.
// ATT : erreur explicite « Slug réservé à l'infrastructure », rien n'est créé.
test('TC-A04 — Slugs réservés refusés', async ({ page }) => {
  test.setTimeout(180_000);
  const avant = nbTenants();
  await loginSaas(page);

  for (const [i, slug] of ['api', 'www', 'admin'].entries()) {
    await page.getByRole('button', { name: 'Provisionner' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('rabatexpress', { exact: true }).fill(slug);
    await dialog.getByPlaceholder('Rabat Express').fill(`Test ${slug}`);
    await dialog.getByPlaceholder('Youssef Tazi').fill('Admin Test');
    await dialog.getByPlaceholder('admin@rabatexpress.ma').fill(`admin@${slug}.ma`);

    const alertMsg = nextAlert(page);
    await dialog.getByRole('button', { name: 'Provisionner' }).click();
    const msg = await alertMsg;
    expect(msg).toContain('réservé');
    console.log(`slug ${slug} → ${msg}`);
    // Le dialogue reste ouvert après le refus : capture puis annulation.
    await shot(page, 'TC-A04', `0${i + 1}-slug-${slug}-refuse`);
    await dialog.getByRole('button', { name: 'Annuler' }).click();
  }

  // Rien n'a été créé : le parc d'organisations est exactement celui d'avant.
  await expect(page.getByRole('row', { name: /^api/ })).toHaveCount(0);
  await shot(page, 'TC-A04', '04-liste-inchangee-apres-refus');
  expect(nbTenants()).toBe(avant);
});
