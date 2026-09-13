import * as fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp, sql } from './helpers';

// TC-F13 — Création par le marchand.
// PAS : se connecter avec un compte marchand → /portail → créer une commande.
// ATT : création autorisée pour le rôle MERCHANT, mais ni assignation ni progression
//       (actions absentes / 403). La commande est attribuée à SON marchand, quoi qu'il
//       envoie — un marchand ne dépose pas de course au nom d'un concurrent.
const EMAIL = 'marchand@rabatexpress.ma';
const MARCHAND = 'Boutique Test';

test('TC-F13 — le marchand crée sa commande, sans pouvoir l’exploiter', async ({ page }) => {
  test.setTimeout(240_000);

  // 1. L'administrateur crée le compte marchand depuis /users (aucun accès shell requis).
  let err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  // Pré-requis (hors périmètre) : le cas doit se rejouer.
  sql(`DELETE FROM tenant_rabatexpress.users WHERE email='${EMAIL}'`);
  await page.reload();

  await page.getByRole('button', { name: 'Inviter' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Nom complet').fill('Rachid Marchand');
  await dlg.getByPlaceholder('prenom.nom@tenant.ma').fill(EMAIL);
  await dlg.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Marchand' }).click();
  await dlg.getByPlaceholder('Boutique Test').fill(MARCHAND);
  await shotVp(page, 'TC-F13', '01-invitation-marchand');
  await dlg.getByRole('button', { name: 'Inviter' }).click();

  const reveal = page.getByRole('dialog').filter({ hasText: 'Mot de passe temporaire' });
  await expect(reveal).toBeVisible({ timeout: 20_000 });
  const mdp = ((await reveal.locator('[style*="code-font"]').first().textContent()) ?? '').trim();
  expect(mdp.length).toBeGreaterThan(8);
  fs.appendFileSync(COMPTES, `TC-F13 rabatexpress MERCHANT ${EMAIL} tempPassword=${mdp}\n`);
  await page.keyboard.press('Escape');
  await shotVp(page, 'TC-F13', '02-compte-marchand-cree');

  // 2. Le marchand se connecte : il atterrit sur SON portail, pas sur la console.
  await logout(page, 'Nadia Alaoui');
  err = await loginTenant(page, 'rabatexpress', EMAIL, mdp);
  console.log(`connexion marchand → ${err ?? 'OK'}`);
  await page.goto('/portail');
  await expect(page.getByText('Espace marchand')).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-F13', '03-portail-marchand');

  // 3. Il crée une commande depuis son portail.
  await page.getByRole('link', { name: 'Nouvelle commande' }).click();
  await expect(page.getByRole('heading', { name: 'Point de retrait' })).toBeVisible();
  await page.getByLabel('Contact').fill('Boutique Test');
  await page.getByLabel('Téléphone').fill('+212611222333');
  await page.getByLabel('Adresse').fill('7 rue du Marché');
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByLabel('Contact').fill('Client du marchand');
  await page.getByLabel('Téléphone').fill('+212644555666');
  await page.getByLabel('Adresse').fill('19 avenue Hassan II');
  await page.getByRole('button', { name: /Continuer/ }).click();
  // Le champ Marchand n'est pas proposé : l'identité vient du compte.
  await expect(page.getByTestId('wizard-merchant')).toHaveCount(0);
  await page.getByLabel('Montant à encaisser (COD)').fill('220');
  await shotVp(page, 'TC-F13', '04-commande-du-marchand');
  await page.getByRole('button', { name: 'Créer la commande' }).click();
  await page.waitForURL(/\/portail\/commandes/, { timeout: 20_000 });

  const creee = sql(
    `SELECT ref, merchant, cod, drop_contact FROM tenant_rabatexpress.orders
      WHERE drop_contact = 'Client du marchand' ORDER BY created_at DESC LIMIT 1`,
  );
  console.log(`commande du marchand → ${creee}`);
  const [ref, marchand] = creee.split(' | ');
  expect(marchand).toBe(MARCHAND);
  await expect(page.getByText(ref)).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-F13', '05-commande-listee-au-portail');

  // 4. Mais il n'exploite pas : ni assignation, ni progression, ni annulation.
  const refus = await page.evaluate(async (r) => {
    const j = { 'content-type': 'application/json' };
    const appel = async (action: string, body: unknown) => {
      const res = await fetch(`/api/orders/${encodeURIComponent(r)}/${action}`, {
        method: 'POST', headers: j, body: JSON.stringify(body),
      });
      return res.status;
    };
    return {
      assign: await appel('assign', { driver: 'Hamid Ouali' }),
      advance: await appel('advance', {}),
      cancel: await appel('cancel', {}),
      console: (await fetch('/api/proxy/v1/drivers')).status,
    };
  }, ref);
  console.log(`actions d'exploitation tentées par le marchand → ${JSON.stringify(refus)}`);
  expect(refus.assign).toBe(403);
  expect(refus.advance).toBe(403);
  expect(refus.cancel).toBe(403);
  expect(refus.console).toBe(403);
  await shotVp(page, 'TC-F13', '06-exploitation-refusee');

  // 5. Et il ne peut pas déposer une course au nom d'un autre marchand.
  const usurpation = await page.evaluate(async () => {
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ merchant: 'Atlas Store', fromCity: 'Rabat', toCity: 'Fès', dropContact: 'Sonde usurpation' }),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  });
  console.log(`tentative au nom d'Atlas Store → ${usurpation.status}`);
  const attribuee = sql(
    `SELECT merchant FROM tenant_rabatexpress.orders WHERE drop_contact='Sonde usurpation' ORDER BY created_at DESC LIMIT 1`,
  );
  console.log(`marchand réellement attribué → ${attribuee}`);
  expect(attribuee).toBe(MARCHAND);
  await shotVp(page, 'TC-F13', '07-usurpation-neutralisee');
});
