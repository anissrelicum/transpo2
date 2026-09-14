import { test, expect } from '@playwright/test';
import { loginSaas, shot, sql, saveCredential, supprimerTenant, nbTenants, lireMotDePasseRevele } from './helpers';

// TC-A03 — Provisionner une organisation (nom, ville, plan, 1er admin).
// ATT : la ligne apparaît au statut Essai, le schéma est créé côté base, et le mot de passe
//       temporaire du premier administrateur est affiché une seule fois.
//
// Le cas travaille sur un slug JETABLE et non sur `rabatexpress` : rejouer le provisionnement
// du tenant de travail exigerait de le détruire, donc d'effacer les commandes, chauffeurs,
// véhicules et zones des sections C à F. Ce qui est prouvé ici, c'est que le provisionnement
// fonctionne — la preuve que `rabatexpress` lui-même a été provisionné date du run initial.
const SLUG = 'recetteprov';

test('TC-A03 — Provisionner une organisation', async ({ page }) => {
  test.setTimeout(180_000);
  supprimerTenant(SLUG);
  const avant = nbTenants();
  await loginSaas(page);

  await page.getByRole('button', { name: 'Provisionner' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Provisionner une organisation')).toBeVisible();

  await dialog.getByPlaceholder('rabatexpress', { exact: true }).fill(SLUG);
  await dialog.getByPlaceholder('Rabat Express').fill('Recette Provisioning');
  // Ville : 3e champ du formulaire (valeur par défaut « Casablanca », sans placeholder).
  await dialog.locator('input').nth(2).fill('Rabat');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Transporteur' }).click();
  await dialog.getByPlaceholder('Youssef Tazi').fill('Nadia Alaoui');
  await dialog.getByPlaceholder('admin@rabatexpress.ma').fill(`admin@${SLUG}.ma`);
  await shot(page, 'TC-A03', '01-dialogue-provisioning-rempli');

  await dialog.getByRole('button', { name: 'Provisionner' }).click();

  // Mot de passe temporaire du 1er admin, affiché une seule fois.
  const reveal = page.getByRole('dialog');
  await expect(reveal.getByText('Compte administrateur créé')).toBeVisible({ timeout: 20_000 });
  await shot(page, 'TC-A03', '02-mot-de-passe-admin-revele');
  const pwd = await lireMotDePasseRevele(reveal);
  saveCredential(`TC-A03 ${SLUG} ADMIN admin@${SLUG}.ma tempPassword=${pwd}`);
  await reveal.getByRole('button', { name: 'Fermer' }).click();

  // La ligne apparaît, abonnement Essai, plan Transporteur.
  const row = page.getByRole('row', { name: new RegExp(SLUG) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Recette Provisioning');
  await expect(row).toContainText('Transporteur');
  await expect(row.getByText('Essai')).toBeVisible();
  await shot(page, 'TC-A03', '03-ligne-en-essai');

  // Schéma créé côté base, et une organisation de plus sur la plateforme.
  expect(sql(`select schema_name from information_schema.schemata where schema_name='tenant_${SLUG}'`)).toContain(SLUG);
  expect(sql(`select slug, name, status from platform.tenants where slug='${SLUG}'`)).toContain(SLUG);
  expect(nbTenants()).toBe(avant + 1);
});
