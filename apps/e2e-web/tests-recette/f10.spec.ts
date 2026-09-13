import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, creerCommandes, sql } from './helpers';

// TC-F10 — Pagination.
// PAS : dépasser une page (8 par page), naviguer avec ‹ / › et les numéros.
// ATT : pagination réelle, page courante mise en évidence, bornes désactivées aux extrémités.
test('TC-F10 — pagination de la liste des commandes', async ({ page }) => {
  test.setTimeout(240_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/orders');

  // Décor : de quoi tenir sur trois pages (8 par page).
  const total = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders`));
  if (total < 20) {
    await creerCommandes(page, Array.from({ length: 20 - total }, (_, i) => ({
      merchant: 'Pagination Test', toCity: i % 2 ? 'Fès' : 'Oujda',
    })));
    await page.reload();
  }
  const attendu = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders`));
  await expect(page.getByTestId('orders-count')).toHaveText(`${attendu} résultat(s)`);
  const pages = Math.ceil(attendu / 8);
  console.log(`${attendu} commande(s) → ${pages} page(s)`);
  expect(pages).toBeGreaterThanOrEqual(3);

  const pagination = page.getByTestId('pagination');
  const precedent = pagination.getByRole('button').first();
  const suivant = pagination.getByRole('button').last();

  // Page 1 : borne gauche désactivée, 8 lignes affichées.
  await expect(precedent).toBeDisabled();
  await expect(page.getByRole('row')).toHaveCount(9); // en-tête + 8
  await shotVp(page, 'TC-F10', '01-page-1');

  // Navigation par le chevron.
  const premiereLigneP1 = await page.getByRole('row').nth(1).innerText();
  await suivant.click();
  await page.waitForTimeout(400);
  const premiereLigneP2 = await page.getByRole('row').nth(1).innerText();
  expect(premiereLigneP2).not.toBe(premiereLigneP1);
  await expect(precedent).toBeEnabled();
  await shotVp(page, 'TC-F10', '02-page-2');

  // Navigation par le numéro, et mise en évidence de la page courante.
  await pagination.getByRole('button', { name: String(pages), exact: true }).click();
  await page.waitForTimeout(400);
  await expect(suivant).toBeDisabled();
  await shotVp(page, 'TC-F10', '03-derniere-page');

  // Retour à la première page.
  await pagination.getByRole('button', { name: '1', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(precedent).toBeDisabled();
  expect(await page.getByRole('row').nth(1).innerText()).toBe(premiereLigneP1);
  await shotVp(page, 'TC-F10', '04-retour-page-1');
});
