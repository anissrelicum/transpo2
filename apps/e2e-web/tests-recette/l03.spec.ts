import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql, jetonLivreur } from './helpers';

// TC-L03 — Écart de caisse.
// ATT : un écart déclaré par le livreur remonte à la comptabilité, se résout avec un
//       motif tracé, et clôture la session.
test('TC-L03 — écart de caisse déclaré par le livreur, résolu par la comptabilité', async ({ page }) => {
  test.setTimeout(180_000);
  const jour = new Date().toISOString().slice(0, 10);

  // Décor : une caisse du jour où le livreur déclare 100 DH de moins que le théorique.
  // La déclaration passe par l'API LIVREUR — c'est le chemin réel, pas un UPDATE.
  const id = sql(`SELECT id FROM tenant_rabatexpress.cash_sessions
                  WHERE driver = 'Hamid Ouali' AND session_date = '${jour}'`).trim();
  expect(id, 'une caisse du jour doit exister').toBeTruthy();
  sql(`UPDATE tenant_rabatexpress.cash_sessions
       SET declared = NULL, status = 'EN_COURS', deposited = 0, reason = NULL, note = NULL WHERE id = '${id}'`);
  const theorique = Number(sql(`SELECT theorique FROM tenant_rabatexpress.cash_sessions WHERE id = '${id}'`).trim());
  expect(theorique).toBeGreaterThan(100);

  const API = process.env.API_URL || 'http://localhost:3000';
  const jeton = await jetonLivreur(page);
  const declare = await page.request.post(`${API}/v1/driver/cash/declare`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress',
               authorization: `Bearer ${jeton}` },
    data: { amount: theorique - 100 },
  });
  expect(declare.ok(), 'le livreur doit pouvoir déclarer sa caisse').toBe(true);
  const apres = await declare.json();
  console.log(`  déclaration livreur → théorique ${apres.theorique}, déclaré ${apres.declared}, écart ${apres.ecart}, statut ${apres.status}`);
  expect(apres.status).toBe('ECART');
  expect(apres.ecart).toBe(100);

  // Côté comptabilité : l'écart est annoncé, pas enfoui.
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/cash');
  await page.waitForTimeout(1500);
  const annonce = await page.locator('body').innerText();
  console.log(`  écran /cash → écart annoncé : ${/Écart/.test(annonce)}`);
  expect(annonce).toMatch(/Écart/);
  await shotVp(page, 'TC-L03', '01-ecart-annonce');

  await page.locator('tr', { hasText: 'Hamid Ouali' }).last().click();
  await expect(page.getByText('COD théorique')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: /Résoudre l’écart de/ })).toBeVisible();
  await shotVp(page, 'TC-L03', '02-session-en-ecart');

  await page.getByRole('button', { name: /Résoudre l’écart de/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByText('Client a payé partiellement').click();
  await dlg.getByRole('textbox').fill('Client a réglé 100 DH de moins, complément promis à la prochaine livraison.');
  await shotVp(page, 'TC-L03', '03-resolution');
  await dlg.getByRole('button', { name: 'Valider la résolution' }).click();

  await expect.poll(
    () => sql(`SELECT status FROM tenant_rabatexpress.cash_sessions WHERE id = '${id}'`).trim(),
    { timeout: 20_000 },
  ).toBe('DEPOSE');
  const [motif, note] = sql(`SELECT reason, note FROM tenant_rabatexpress.cash_sessions WHERE id = '${id}'`)
    .split('|').map((x) => x.trim());
  console.log(`  écart résolu → motif « ${motif} », note « ${note.slice(0, 40)}… »`);
  expect(motif).toBe('Client a payé partiellement');
  expect(note).toContain('100 DH');
  await page.reload();
  await page.locator('tr', { hasText: 'Hamid Ouali' }).last().click();
  await expect(page.getByText('COD théorique')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  await expect(page.getByText(/Écart résolu/)).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-L03', '04-session-close');
});
