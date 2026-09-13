import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql } from './helpers';

// TC-F01 — Créer la première commande (assistant).
// PAS : /orders/new → point de retrait → point de livraison → colis & options → Créer.
// ATT : référence CMD-… et code de suivi 8 caractères générés, statut Nouvelle, et la
//       commande créée est ATTEIGNABLE depuis l'écran d'arrivée.
test('TC-F01 — création d’une commande par l’assistant', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();

  // Pré-requis (hors périmètre) : repartir d'un carnet vide pour que le cas se rejoue.
  await page.goto('/orders');
  await page.evaluate(async () => {
    const d = await (await fetch('/api/proxy/v1/orders?limit=500')).json();
    for (const o of (Array.isArray(d) ? d : d.items ?? [])) {
      await fetch(`/api/proxy/v1/orders/${o.ref}/cancel`, { method: 'POST' }).catch(() => {});
    }
  });

  await page.goto('/orders/new');
  await expect(page.getByRole('heading', { name: 'Nouvelle commande' })).toBeVisible();
  await shotVp(page, 'TC-F01', '01-assistant-etape-1');

  // Étape 1 — point de retrait.
  await expect(page.getByRole('heading', { name: 'Point de retrait' })).toBeVisible();
  await page.getByLabel('Contact').fill('Atelier Rabat');
  await page.getByLabel('Téléphone').fill('+212611000001');
  await page.getByLabel('Adresse').fill('12 rue des Consuls, Médina');
  await page.getByLabel('Ville').click();
  await page.getByRole('option', { name: 'Rabat', exact: true }).click();
  await page.getByRole('button', { name: /Continuer/ }).click();

  // Étape 2 — point de livraison.
  await expect(page.getByRole('heading', { name: 'Point de livraison' })).toBeVisible();
  await page.getByLabel('Contact').fill('Yasmine Cherkaoui');
  await page.getByLabel('Téléphone').fill('+212622000002');
  await page.getByLabel('Adresse').fill('45 bd Anfa, 3ᵉ étage');
  await page.getByLabel('Ville').click();
  await page.getByRole('option', { name: 'Casablanca', exact: true }).click();
  await shotVp(page, 'TC-F01', '02-point-de-livraison');
  await page.getByRole('button', { name: /Continuer/ }).click();

  // Étape 3 — colis & options.
  await expect(page.getByRole('heading', { name: 'Colis & options' })).toBeVisible();
  // Le champ Marchand est une liste dès qu'un marchand existe, une saisie libre sinon :
  // l'assistant change de forme selon le carnet, le cas doit suivre.
  const champMarchand = page.getByTestId('wizard-merchant');
  if ((await champMarchand.evaluate((el) => el.tagName)) === 'BUTTON') {
    await champMarchand.click();
    await page.getByRole('option', { name: 'Boutique Test' }).click();
  } else {
    await champMarchand.fill('Boutique Test');
  }
  await page.getByLabel('Niveau de preuve exigé').click();
  await page.getByRole('option', { name: 'photo', exact: true }).click();
  await page.getByLabel('Montant à encaisser (COD)').fill('450');
  await shotVp(page, 'TC-F01', '03-colis-et-options');

  await page.getByRole('button', { name: 'Créer la commande' }).click();
  // On atterrit sur LA commande créée, pas sur une liste où il faudrait la retrouver.
  await page.waitForURL(/\/orders\/CMD-/, { timeout: 20_000 });
  await page.waitForLoadState('domcontentloaded');
  await shotVp(page, 'TC-F01', '04-fiche-de-la-commande-creee');

  // La commande existe, avec sa référence et son code de suivi.
  const creee = sql(
    `SELECT ref, code, status, from_city, to_city, cod, proof_level, merchant
       FROM tenant_rabatexpress.orders ORDER BY created_at DESC LIMIT 1`,
  );
  console.log(`commande créée → ${creee}`);
  const [ref, code, statut, depart, arrivee, cod, preuve, marchand] = creee.split(' | ');
  expect(ref).toMatch(/^CMD-/);
  expect(code).toHaveLength(8);
  expect(statut).toBe('NOUVELLE');
  expect(depart).toBe('Rabat');
  expect(arrivee).toBe('Casablanca');
  expect(cod).toBe('450');
  expect(preuve).toBe('photo');
  expect(marchand).toBe('Boutique Test');

  // Et l'exploitant la retrouve : elle est listée, avec son statut.
  await page.goto('/orders');
  const ligne = page.getByRole('row', { name: new RegExp(ref) });
  await expect(ligne).toBeVisible({ timeout: 15_000 });
  await expect(ligne.getByText('Nouvelle')).toBeVisible();
  await shotVp(page, 'TC-F01', '05-commande-listee');

  // Les coordonnées saisies aux étapes 1 et 2 doivent avoir été conservées : une livraison
  // sans adresse ni contact n'est pas une livraison.
  const adresses = sql(
    `SELECT pickup_contact, pickup_address, drop_contact, drop_address
       FROM tenant_rabatexpress.orders WHERE ref = '${ref}'`,
  );
  console.log(`coordonnées enregistrées → ${adresses}`);
  expect(adresses).toContain('Atelier Rabat');
  expect(adresses).toContain('Yasmine Cherkaoui');
  expect(adresses).toContain('45 bd Anfa');
});
