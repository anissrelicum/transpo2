import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-E04 — Retirer un livreur / supprimer une zone.
// PAS : retirer le livreur → Enregistrer ; créer une zone jetable → Supprimer la zone.
// ATT : les deux opérations sont effectives après rechargement.
test('TC-E04 — retrait d’un livreur et suppression d’une zone', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/zones');
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();

  // 1. Retrait d'un livreur : la croix du badge.
  await expect(page.getByText('Livreurs affectés · 2')).toBeVisible();
  await page.locator('.rt-Badge', { hasText: 'Sara Bennis' }).locator('svg').click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Livreurs affectés · 1')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Livreurs affectés · 1')).toBeVisible();
  const restants = sql(`SELECT drivers FROM tenant_rabatexpress.zones WHERE name_fr='Rabat Centre'`);
  console.log(`livreurs restants → ${restants}`);
  expect(restants).not.toContain('Sara Bennis');
  await shotVp(page, 'TC-E04', '01-livreur-retire');

  // 2. Zone jetable créée puis supprimée.
  await page.getByRole('button', { name: 'Nouvelle zone' }).click();
  await expect(page.getByText('Zones définies · 2')).toBeVisible();
  await shotVp(page, 'TC-E04', '02-zone-jetable-creee');

  await page.getByRole('button', { name: 'Supprimer la zone' }).click();
  const alerte = page.getByRole('alertdialog');
  await expect(alerte.getByRole('heading', { name: /Supprimer la zone/ })).toBeVisible();
  await expect(alerte.getByText(/Cette action est définitive/)).toBeVisible();
  await shotVp(page, 'TC-E04', '03-confirmation-de-suppression');
  await alerte.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByText('Zones définies · 1')).toBeVisible();
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();
  await shotVp(page, 'TC-E04', '04-zone-jetable-supprimee');
});
