import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, viderCommandes, sql } from './helpers';

// TC-F02 — Créer un jeu de commandes.
// PAS : répéter TC-F01 pour obtenir au moins 6 commandes : 2 avec COD, 2 prépayées,
//       1 en preuve photo_signature, 1 en preuve aucune, villes variées.
// ATT : toutes listées dans /orders.
// Le jeu créé ici sert de décor à toute la section F.
const JEU = [
  { marchand: 'Boutique Test', de: 'Rabat', vers: 'Casablanca', cod: '450', preuve: 'photo' },
  { marchand: 'Boutique Test', de: 'Casablanca', vers: 'Marrakech', cod: '780', preuve: 'photo_signature' },
  { marchand: 'Atlas Store', de: 'Rabat', vers: 'Kénitra', cod: '', preuve: 'signature' },
  { marchand: 'Atlas Store', de: 'Tanger', vers: 'Tétouan', cod: '', preuve: 'aucune' },
  { marchand: 'Boutique Test', de: 'Fès', vers: 'Meknès', cod: '120', preuve: 'photo' },
  { marchand: 'Atlas Store', de: 'Agadir', vers: 'Marrakech', cod: '', preuve: 'photo_signature' },
];

test('TC-F02 — jeu de six commandes créé par l’assistant', async ({ page }) => {
  test.setTimeout(300_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/orders');
  await viderCommandes(page);
  await expect(page.getByText('Aucune commande', { exact: true })).toBeVisible();
  await shotVp(page, 'TC-F02', '01-carnet-vide');

  for (const [i, c] of JEU.entries()) {
    await page.goto('/orders/new');
    await page.getByLabel('Contact').fill(`Expéditeur ${i + 1}`);
    await page.getByLabel('Téléphone').fill('+212611000000');
    await page.getByLabel('Adresse').fill(`${i + 1} rue du Départ`);
    await page.getByLabel('Ville').click();
    await page.getByRole('option', { name: c.de, exact: true }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    await page.getByLabel('Contact').fill(`Destinataire ${i + 1}`);
    await page.getByLabel('Téléphone').fill('+212622000000');
    await page.getByLabel('Adresse').fill(`${i + 1} avenue de l’Arrivée`);
    await page.getByLabel('Ville').click();
    await page.getByRole('option', { name: c.vers, exact: true }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    const champMarchand = page.getByTestId('wizard-merchant');
    if ((await champMarchand.evaluate((el) => el.tagName)) === 'BUTTON') {
      await champMarchand.click();
      const option = page.getByRole('option', { name: c.marchand, exact: true });
      if (await option.count()) await option.click();
      else await page.keyboard.press('Escape');
    } else {
      await champMarchand.fill(c.marchand);
    }
    await page.getByLabel('Niveau de preuve exigé').click();
    await page.getByRole('option', { name: c.preuve, exact: true }).click();
    if (c.cod) await page.getByLabel('Montant à encaisser (COD)').fill(c.cod);
    await page.getByRole('button', { name: 'Créer la commande' }).click();
    await page.waitForURL(/\/orders\/CMD-/, { timeout: 20_000 });
  }
  await shotVp(page, 'TC-F02', '02-six-commandes-creees');

  // Les six sont listées, et le jeu couvre bien COD / prépayé / niveaux de preuve.
  await page.goto('/orders');
  await expect(page.getByTestId('orders-count')).toHaveText('6 résultat(s)');
  await shotVp(page, 'TC-F02', '03-liste-des-six');

  const repartition = sql(
    `SELECT count(*) FILTER (WHERE cod > 0), count(*) FILTER (WHERE cod = 0),
            count(DISTINCT proof_level), count(DISTINCT from_city)
       FROM tenant_rabatexpress.orders`,
  );
  console.log(`avec COD | prépayées | niveaux de preuve | villes de départ → ${repartition}`);
  const [avecCod, prepayees, preuves, villes] = repartition.split(' | ').map(Number);
  expect(avecCod).toBeGreaterThanOrEqual(2);
  expect(prepayees).toBeGreaterThanOrEqual(2);
  expect(preuves).toBeGreaterThanOrEqual(4);
  expect(villes).toBeGreaterThanOrEqual(4);
});
