import { test, expect } from '@playwright/test';
import { loginSaas, openTenantMenu, shot, sql, supprimerTenant } from './helpers';

// TC-A08 — Convertir un essai en abonnement : menu « … » → Convertir l'essai → plan
// Entreprise → Valider. ATT : l'abonnement passe à Actif avec échéance, plan = Entreprise.
//
// Joué sur une organisation JETABLE, en essai : `rabatexpress` a été converti une fois pour
// toutes au run initial, et le reconvertir supposerait de le remettre en essai — un aller-
// retour sur l'abonnement du tenant de travail dont dépendent les sections suivantes.
const SLUG = 'recetteconv';

test('TC-A08 — Convertir l’essai en abonnement Entreprise', async ({ page }) => {
  test.setTimeout(180_000);
  supprimerTenant(SLUG);
  await loginSaas(page);
  await page.evaluate(async (slug) => {
    await fetch('/api/proxy/v1/saas/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug, name: 'Recette Conversion', city: 'Rabat', planCode: 'transporteur',
        adminEmail: `admin@${slug}.ma`, adminName: 'Admin Conversion',
      }),
    });
  }, SLUG);
  await page.reload();

  const ligne = page.locator('tr', { hasText: SLUG }).first();
  await expect(ligne).toContainText('Essai');
  await expect(ligne).toContainText('Transporteur');
  await shot(page, 'TC-A08', '01-avant-essai-transporteur');

  await openTenantMenu(page, SLUG);
  await page.getByRole('menuitem', { name: /Convertir l’essai/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/L’essai se transforme en abonnement actif/)).toBeVisible();
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: /Entreprise/ }).click();
  await shot(page, 'TC-A08', '02-dialogue-conversion-entreprise');

  await dialog.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Abonnement Actif avec échéance au 1er du mois prochain, plan Entreprise.
  await expect(ligne).toContainText('Actif', { timeout: 20_000 });
  await expect(ligne).toContainText('échéance');
  await expect(ligne).toContainText('Entreprise');
  // Le tarif affiché est celui de la DERNIÈRE version publiée du plan — y compris à effet
  // futur, cf. le constat consigné avec TC-A11. Il n'est donc pas figé dans le cas : une
  // version publiée en cours de recette (TC-A16) le change.
  const centimes = Number(sql(`
    SELECT pv.monthly_centimes FROM platform.plans p
      JOIN platform.plan_versions pv ON pv.plan_id = p.id
     WHERE p.code = 'entreprise'
     ORDER BY pv.effective_from DESC LIMIT 1`));
  const attendu = `${Math.round(centimes / 100).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} DH/mois`;
  console.log(`tarif Entreprise courant → ${attendu}`);
  await expect(ligne).toContainText(attendu);
  await shot(page, 'TC-A08', '03-apres-actif-entreprise');

  // Non-régression AN-13 : la console reste vivante après la fermeture du dialogue.
  const racineMasquee = await page.locator('div.radix-themes[aria-hidden="true"]').count();
  console.log(`racine aria-hidden après fermeture → ${racineMasquee}`);
  expect(racineMasquee).toBe(0);

  // Ménage : l'organisation jetable ne doit pas rester au parc.
  supprimerTenant(SLUG);
  await page.reload();
  await expect(page.locator('tr', { hasText: SLUG })).toHaveCount(0);
});