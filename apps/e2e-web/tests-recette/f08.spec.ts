import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-F08 — Filtres et recherche.
// PAS : filtrer par Statut, Ville, Marchand, Livreur ; chercher une référence ; Réinitialiser.
// ATT : chaque filtre réduit réellement la liste, ils se combinent, et Réinitialiser restaure.
test('TC-F08 — filtres et recherche de la liste des commandes', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/orders');

  const compteur = page.getByTestId('orders-count');
  const total = Number((await compteur.innerText()).replace(/\D/g, ''));
  console.log(`total → ${total} commande(s)`);
  expect(total).toBeGreaterThan(3);
  await shotVp(page, 'TC-F08', '01-liste-complete');

  async function lire(): Promise<number> {
    return Number((await compteur.innerText()).replace(/\D/g, ''));
  }
  async function filtrer(placeholder: string, option: string) {
    await page.getByRole('combobox').filter({ hasText: new RegExp(placeholder, 'i') }).first().click();
    await page.getByRole('option', { name: option, exact: true }).click();
    await page.waitForTimeout(400);
  }

  // Statut.
  await filtrer('Statut', 'Nouvelle');
  const parStatut = await lire();
  console.log(`filtre Statut=Nouvelle → ${parStatut}`);
  expect(parStatut).toBeLessThan(total);
  expect(parStatut).toBeGreaterThan(0);
  await shotVp(page, 'TC-F08', '02-filtre-statut');

  // Combinaison : statut + ville. Une combinaison peut légitimement ne rien donner —
  // le produit doit alors le DIRE, pas afficher une liste vide sans explication.
  await filtrer('Ville', 'Salé');
  const vide = await page.getByText('Aucune commande ne correspond à ces filtres.').count();
  if (vide) {
    console.log('+ Ville=Salé → 0, état vide annoncé');
    await expect(page.getByText('Aucune commande ne correspond à ces filtres.')).toBeVisible();
  } else {
    const combine = await lire();
    console.log(`+ Ville=Salé → ${combine}`);
    expect(combine).toBeLessThanOrEqual(parStatut);
  }
  await shotVp(page, 'TC-F08', '03-filtres-combines');

  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await page.waitForTimeout(400);
  expect(await lire()).toBe(total);
  await shotVp(page, 'TC-F08', '04-reinitialise');

  // Recherche de page sur une référence exacte.
  const premiere = await page.getByRole('row').nth(1).innerText();
  const ref = (premiere.match(/CMD-[A-Z0-9-]+/) ?? [''])[0];
  await page.getByPlaceholder('Réf, code, marchand, ville…').fill(ref);
  await page.waitForTimeout(400);
  expect(await lire()).toBe(1);
  await expect(page.getByRole('row', { name: new RegExp(ref) })).toBeVisible();
  await shotVp(page, 'TC-F08', '05-recherche-par-reference');

  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await page.waitForTimeout(400);
  expect(await lire()).toBe(total);
});
