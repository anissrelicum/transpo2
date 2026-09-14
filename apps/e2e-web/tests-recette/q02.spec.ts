import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-Q02 / TC-Q03 / TC-Q04 — Arbitrage d'un cas de fraude.
// ATT : Ouvert → Enquête → Confirmé (ou Blanchi), chaque décision tracée au journal d'audit.
test('TC-Q02 — enquête, confirmation et blanchiment d’un cas', async ({ page }) => {
  test.setTimeout(180_000);
  const id = sql(`SELECT id FROM tenant_rabatexpress.fraud_cases
                  WHERE driver = 'Hamid Ouali' ORDER BY created_at DESC LIMIT 1`).trim();
  expect(id, 'un cas doit exister (TC-Q01)').toBeTruthy();
  const statut = () => sql(`SELECT status FROM tenant_rabatexpress.fraud_cases WHERE id = '${id}'`).trim();

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/fraud');
  await page.waitForTimeout(2000);
  await page.getByText('Hamid Ouali').first().click();
  await page.waitForTimeout(1200);
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
  sql(`INSERT INTO tenant_rabatexpress.fraud_cases (driver, amount, signals, score, status, summary)
       VALUES ('Sara Bennis', 0, ARRAY['absent_eleve'], 18, 'OUVERT', 'Taux d''absence à vérifier')`);
  await page.reload();
  await page.waitForTimeout(2000);
  await page.getByText('Sara Bennis').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Blanchir' }).first().click();
  await expect.poll(
    () => sql(`SELECT status FROM tenant_rabatexpress.fraud_cases WHERE driver = 'Sara Bennis'`).trim(),
    { timeout: 20_000 },
  ).toBe('BLANCHI');
  console.log('  second cas → Blanchi');
  await shotVp(page, 'TC-Q02', '04-blanchi');
});
