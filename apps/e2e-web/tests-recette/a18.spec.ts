import { test, expect } from '@playwright/test';
import { loginSaas, nextAlert, openPlanMenu, shotVp, sql } from './helpers';

// TC-A18 — Archivage protégé : archiver un plan avec abonnés (Entreprise) est refusé ;
// archiver un plan sans abonné (pay-as-you-go) le sort du catalogue et du sélecteur de /saas ;
// visible avec « Afficher les plans archivés » ; Restaurer le remet au catalogue.
test('TC-A18 — Archivage protégé', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  // 1. Plan avec abonné (Entreprise, 1) : archivage refusé.
  await openPlanMenu(page, 'entreprise');
  await page.getByRole('menuitem', { name: 'Archiver' }).click();
  const confirm = page.getByRole('alertdialog');
  // Le nombre d'abonnés se lit en base : il dépend des cas joués avant celui-ci.
  const abonnes = sql(`
    SELECT count(s.id) FROM platform.plans p
      JOIN platform.plan_versions pv ON pv.plan_id = p.id
      JOIN platform.subscriptions s ON s.plan_version_id = pv.id AND s.ended_at IS NULL
     WHERE p.code = 'entreprise'`);
  console.log(`abonnés au plan Entreprise → ${abonnes}`);
  await expect(confirm.getByText(new RegExp(`${abonnes} organisation\\(s\\) y sont abonnées`))).toBeVisible();
  await shotVp(page, 'TC-A18', '01-confirmation-archivage-entreprise');
  const refused = nextAlert(page);
  await confirm.getByRole('button', { name: 'Archiver' }).click();
  const msg = await refused;
  console.log(`archivage entreprise → ${msg}`);
  expect(msg).toContain('organisation(s) sont abonnées à ce plan');
  await page.reload(); // referme proprement menu + dialogue (aria-hidden Radix)
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Entreprise/ })).toBeVisible();
  await shotVp(page, 'TC-A18', '02-archivage-entreprise-refuse');

  // 2. Plan sans abonné (pay-as-you-go, 0) : archivage effectif.
  await openPlanMenu(page, 'pay-as-you-go');
  await page.getByRole('menuitem', { name: 'Archiver' }).click();
  await expect(confirm.getByText(/Aucun abonné/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Archiver' }).click();
  await page.reload();
  // Sorti du catalogue par défaut (4 lignes visibles).
  await expect(page.locator('table tbody tr')).toHaveCount(4, { timeout: 30_000 });
  await expect(page.getByRole('row', { name: /pay-as-you-go/ })).toHaveCount(0);
  await shotVp(page, 'TC-A18', '03-payg-archive-hors-catalogue');

  // Visible uniquement avec « Afficher les plans archivés » (badge Archivé sur la carte).
  await page.getByRole('switch').check();
  await expect(page.getByRole('row', { name: /pay-as-you-go/ })).toBeVisible();
  await expect(page.getByText('Archivé', { exact: true }).first()).toBeVisible();
  await shotVp(page, 'TC-A18', '04-payg-visible-plans-archives');

  // Sorti du sélecteur de plan de /saas.
  await page.goto('/saas');
  await page.getByRole('button', { name: 'Provisionner' }).click();
  const prov = page.getByRole('dialog');
  await prov.getByRole('combobox').click();
  await expect(page.getByRole('option', { name: 'Pay as you go' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Transporteur' })).toBeVisible();
  await shotVp(page, 'TC-A18', '05-selecteur-provisioning-sans-payg');
  await page.keyboard.press('Escape');
  await prov.getByRole('button', { name: 'Annuler' }).click();

  // 3. Restaurer : retour au catalogue.
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
  await page.getByRole('switch').check();
  await openPlanMenu(page, 'pay-as-you-go');
  await page.getByRole('menuitem', { name: 'Restaurer' }).click();
  await page.reload();
  await expect(page.getByRole('row', { name: /pay-as-you-go/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('row', { name: /pay-as-you-go/ })).not.toContainText('Archivé');
  await expect(page.locator('table tbody tr')).toHaveCount(5);
  await shotVp(page, 'TC-A18', '06-payg-restaure');
});
