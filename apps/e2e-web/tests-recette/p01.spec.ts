import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-P01 / TC-P02 — Journal des notifications et envoi manuel.
// ATT : journal avec destinataire, canal, statut, date ; filtres réels ; un envoi manuel
//       apparaît au journal avec son statut.
test('TC-P01 — journal des notifications et envoi manuel', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  await page.goto('/notifications');
  await page.waitForTimeout(2000);
  await shotVp(page, 'TC-P01', '01-journal');
  const avant = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.notifications`).trim());
  console.log(`  journal → ${avant} notification(s) en base`);

  await page.getByRole('button', { name: /Envoyer une notification/ }).click();
  const dlg = page.getByRole('dialog');
  const destinataire = '+212600112233';
  await dlg.getByRole('textbox').first().fill(destinataire);
  await shotVp(page, 'TC-P01', '02-formulaire-envoi');
  await dlg.getByRole('button', { name: /Envoyer/ }).last().click();
  await page.waitForTimeout(2500);

  const apres = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.notifications`).trim());
  console.log(`  après envoi → ${apres} notification(s)`);
  expect(apres).toBe(avant + 1);

  const derniere = sql(`SELECT recipient, channel, status, event FROM tenant_rabatexpress.notifications
                        ORDER BY created_at DESC LIMIT 1`).split('|').map((x) => x.trim());
  console.log(`  dernière → ${derniere.join(' · ')}`);
  expect(derniere[0]).toBe(destinataire);

  await page.reload();
  await page.waitForTimeout(2000);
  const corps = await page.locator('body').innerText();
  expect(corps).toContain(destinataire);
  await shotVp(page, 'TC-P01', '03-journal-a-jour');
});
