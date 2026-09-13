import { test, expect } from '@playwright/test';
import { loginSaas, shot, sql, saveCredential, supprimerTenant, nbTenants } from './helpers';

// TC-A06 — Provisionner une seconde organisation (isolation).
// ATT : les deux organisations sont listées, chacune avec son plan et son schéma.
// Slugs jetables, comme en TC-A03 : le cas se termine en les supprimant tous les deux,
// pour que la plateforme retrouve exactement l'état qu'elle avait avant la section.
const SLUG = 'recetteiso';
const PREMIER = 'recetteprov';

test('TC-A06 — Provisionner une seconde organisation', async ({ page }) => {
  test.setTimeout(180_000);
  supprimerTenant(SLUG);
  await loginSaas(page);
  // Pré-requis (hors périmètre) : la PREMIÈRE organisation doit exister pour que le cas
  // parle d'isolation. TC-A03 la crée ; jouée seule, TC-A06 la pose elle-même.
  if (!sql(`select slug from platform.tenants where slug='${PREMIER}'`)) {
    await page.evaluate(async (slug) => {
      await fetch('/api/proxy/v1/saas/tenants', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug, name: 'Recette Provisioning', city: 'Rabat', planCode: 'transporteur',
          adminEmail: `admin@${slug}.ma`, adminName: 'Nadia Alaoui',
        }),
      });
    }, PREMIER);
    await page.reload();
  }
  const avant = nbTenants();

  await page.getByRole('button', { name: 'Provisionner' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('rabatexpress', { exact: true }).fill(SLUG);
  await dialog.getByPlaceholder('Rabat Express').fill('Recette Isolation');
  await dialog.locator('input').nth(2).fill('Tanger');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'TPE Coursier' }).click();
  await dialog.getByPlaceholder('Youssef Tazi').fill('Karim Bennis');
  await dialog.getByPlaceholder('admin@rabatexpress.ma').fill(`admin@${SLUG}.ma`);
  await shot(page, 'TC-A06', '01-dialogue-provisioning-tangerlog');

  await dialog.getByRole('button', { name: 'Provisionner' }).click();

  const reveal = page.getByRole('dialog');
  await expect(reveal.getByText('Compte administrateur créé')).toBeVisible({ timeout: 20_000 });
  await shot(page, 'TC-A06', '02-mot-de-passe-admin-tangerlog');
  const pwd = (await reveal.locator('code, [style*="code-font"]').first().textContent()) ?? '';
  const m = /([A-Za-z0-9!?@#-]{6,})/.exec(pwd);
  if (m) saveCredential(`TC-A06 ${SLUG} ADMIN admin@${SLUG}.ma tempPassword=${m[1]}`);
  await reveal.getByRole('button', { name: 'Fermer' }).click();

  // Les deux organisations de recette sont listées, chacune avec son plan.
  await expect(page.getByRole('row', { name: new RegExp(PREMIER) })).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(SLUG) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Recette Isolation');
  await expect(row).toContainText('TPE Coursier');
  await expect(row.getByText('Essai')).toBeVisible();
  await shot(page, 'TC-A06', '03-deux-organisations-listees');

  // Chaque organisation a son PROPRE schéma : c'est là que se joue l'isolation.
  expect(sql(`select schema_name from information_schema.schemata where schema_name='tenant_${SLUG}'`)).toContain(SLUG);
  expect(sql(`select schema_name from information_schema.schemata where schema_name='tenant_${PREMIER}'`)).toContain(PREMIER);
  expect(nbTenants()).toBe(avant + 1);

  // Ménage : la section A rend la plateforme telle qu'elle l'a trouvée.
  supprimerTenant(SLUG);
  supprimerTenant(PREMIER);
  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(SLUG) })).toHaveCount(0);
  await expect(page.getByRole('row', { name: new RegExp(PREMIER) })).toHaveCount(0);
  await shot(page, 'TC-A06', '04-slugs-jetables-supprimes');
});
