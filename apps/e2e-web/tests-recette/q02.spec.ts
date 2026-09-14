import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-Q02 / TC-Q03 / TC-Q04 — Arbitrage d'un cas de fraude.
// ATT : Ouvert → Enquête → Confirmé (ou Blanchi), chaque décision tracée au journal d'audit.
test('TC-Q02 — enquête, confirmation et blanchiment d’un cas', async ({ page }) => {
  test.setTimeout(180_000);
  // Décor : un dossier OUVERT au nom du livreur. Reprendre celui de TC-Q01 rendait ce cas
  // dépendant de son arbitrage — une fois le dossier confirmé, il n'y avait plus d'enquête
  // à ouvrir et le cas échouait sur un bouton absent, ce qui n'apprenait rien.
  sql(`DELETE FROM tenant_rabatexpress.fraud_cases WHERE driver = 'Hamid Ouali'`);
  sql(`INSERT INTO tenant_rabatexpress.fraud_cases (driver, amount, signals, score, status, summary)
       VALUES ('Hamid Ouali', 150, ARRAY['ecart_cash'], 30, 'OUVERT', 'Écart de caisse de 150 DH')`);
  const id = sql(`SELECT id FROM tenant_rabatexpress.fraud_cases
                  WHERE driver = 'Hamid Ouali' ORDER BY created_at DESC LIMIT 1`).trim();
  expect(id, 'un dossier ouvert doit exister').toBeTruthy();
  const statut = () => sql(`SELECT status FROM tenant_rabatexpress.fraud_cases WHERE id = '${id}'`).trim();

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/fraud');
  await page.waitForTimeout(2000);
  // Ouvrir le DOSSIER par sa ligne : le nom apparaît aussi au classement des livreurs à
  // risque, et cliquer celui-là n'ouvre rien.
  // L'écran porte deux tables : les dossiers et le classement des livreurs à risque.
  // C'est la ligne du DOSSIER qui ouvre le volet d'arbitrage.
  await page.locator('tr', { hasText: 'Hamid Ouali' }).first().click();
  await expect(page.getByRole('button', { name: /Ouvrir une enquête/ })).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-Q02', '01-cas-ouvert');

  await page.getByRole('button', { name: /Ouvrir une enquête|Enquêter/ }).first().click();
  await expect.poll(statut, { timeout: 20_000 }).toBe('ENQUETE');
  console.log('  Ouvert → Enquête');
  await shotVp(page, 'TC-Q02', '02-enquete');

  // Confirmer est une décision lourde : elle passe par une confirmation explicite et
  // doit être tracée au journal d'audit.
  const avantAudit = sql(`SELECT count(*) FROM platform.audit_log WHERE action LIKE 'fraud.%'`).trim();
  await page.getByRole('button', { name: 'Confirmer la fraude' }).click();
  const alerte = page.getByRole('alertdialog');
  await expect(alerte.getByText(/Confirmer la fraude — Hamid Ouali/)).toBeVisible();
  await alerte.getByRole('button', { name: 'Confirmer', exact: true }).click();
  await expect.poll(statut, { timeout: 20_000 }).toBe('CONFIRME');
  console.log('  Enquête → Confirmé');
  const apresAudit = sql(`SELECT count(*) FROM platform.audit_log WHERE action LIKE 'fraud.%'`).trim();
  console.log(`  journal d’audit fraude : ${avantAudit} → ${apresAudit}`);
  expect(Number(apresAudit)).toBeGreaterThan(Number(avantAudit));
  await shotVp(page, 'TC-Q02', '03-confirme');

  // Blanchir un second cas : il sort de la liste active.
  // Un seul cas témoin : sans purge, chaque passage en empilait un de plus et la
  // vérification comparait quatre statuts à la fois.
  sql(`DELETE FROM tenant_rabatexpress.fraud_cases WHERE driver = 'Sara Bennis'`);
  sql(`INSERT INTO tenant_rabatexpress.fraud_cases (driver, amount, signals, score, status, summary)
       VALUES ('Sara Bennis', 0, ARRAY['absent_eleve'], 18, 'OUVERT', 'Taux d''absence à vérifier')`);
  await page.reload();
  await page.waitForTimeout(2000);
  await page.locator('tr', { hasText: 'Sara Bennis' }).first().click();
  await expect(page.getByRole('button', { name: 'Blanchir' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Blanchir' }).first().click();
  await expect.poll(
    () => sql(`SELECT status FROM tenant_rabatexpress.fraud_cases
                WHERE driver = 'Sara Bennis' ORDER BY created_at DESC LIMIT 1`).trim(),
    { timeout: 20_000 },
  ).toBe('BLANCHI');
  console.log('  second cas → Blanchi');
  await shotVp(page, 'TC-Q02', '04-blanchi');
});
