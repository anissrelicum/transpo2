import { test, expect } from '@playwright/test';
import { loginSaas, shotVp } from './helpers';

// TC-A20 — Traçabilité : après TC-A13 → TC-A18, /saas/audit trace plan.create, plan.version,
// plan.archive, plan.restore avec acteur et cible.
test('TC-A20 — Traçabilité audit', async ({ page }) => {
  test.setTimeout(120_000);
  await loginSaas(page);
  await page.goto('/saas/audit');
  await expect(page.getByRole('heading', { name: /Audit|Journal/ })).toBeVisible();

  // plan.create — cible pay-as-you-go, acteur ops@transpo.ma.
  const create = page.getByRole('row', { name: /plan\.create/ });
  await expect(create.first()).toBeVisible();
  await expect(create.first()).toContainText('pay-as-you-go');
  await expect(create.first()).toContainText('ops@transpo.ma');
  await shotVp(page, 'TC-A20', '01-audit-plan-create');

  // plan.version — publication du tarif TC-A13 (et v2 Entreprise TC-A16).
  const version = page.getByRole('row', { name: /plan\.version/ });
  await expect(version.first()).toBeVisible();
  await expect(version.filter({ hasText: 'pay-as-you-go' }).first()).toBeVisible();
  await expect(version.filter({ hasText: 'entreprise' }).first()).toBeVisible();
  await shotVp(page, 'TC-A20', '02-audit-plan-version');

  // plan.archive — la tentative refusée sur entreprise est-elle tracée ? Le service ne trace
  // que l'archivage effectif (pay-as-you-go) : vérifier archive + restore sur cette cible.
  const archive = page.getByRole('row', { name: /plan\.archive/ });
  await expect(archive.first()).toBeVisible();
  await expect(archive.first()).toContainText('pay-as-you-go');
  const restore = page.getByRole('row', { name: /plan\.restore/ });
  await expect(restore.first()).toBeVisible();
  await expect(restore.first()).toContainText('pay-as-you-go');
  await shotVp(page, 'TC-A20', '03-audit-plan-archive-restore');
});
