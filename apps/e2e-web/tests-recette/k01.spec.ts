import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql, echouerCommeLivreur } from './helpers';

// TC-K01 — Un échec de livraison crée un retour.
// PRÉ : TC-G10 (échec déclaré depuis l'app livreur).
// ATT : la commande échouée est listée « À traiter », 1/3 tentative, motif affiché, et
//       le COD bloqué est compté.
test('TC-K01 — l’échec du terrain ouvre un retour à traiter', async ({ page }) => {
  test.setTimeout(180_000);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Décor : un échec déclaré depuis le terrain, par le chemin de l'app livreur.
  const echec = await echouerCommeLivreur(page, { cod: 340 });
  const ligne = sql(`SELECT ref, status, attempts, reason FROM tenant_rabatexpress.returns
                     WHERE ref = '${echec.ref}'`).split('|').map((x) => x.trim());
  const [ref, statut, tentatives, motif] = ligne;
  console.log(`  retour en base → ${ref} · ${statut} · ${tentatives} tentative(s) · « ${motif} »`);
  expect(statut).toBe('A_TRAITER');
  expect(tentatives).toBe('1');
  await page.goto('/returns');
  await page.waitForTimeout(1500);
  await shotVp(page, 'TC-K01', '01-retours-actifs');

  const corps = await page.locator('body').innerText();
  expect(corps).toContain(ref);
  expect(corps).toContain('À traiter');

  // Le motif remonté par le livreur doit être lisible par l'exploitation : c'est sur lui
  // qu'elle décide de reprogrammer ou de rendre au marchand.
  await page.getByText(ref).first().click();
  await page.waitForTimeout(1200);
  const detail = await page.locator('body').innerText();
  expect(detail).toContain(motif.split('—')[0].trim());
  expect(detail).toMatch(/1\/3 tentatives/);
  await shotVp(page, 'TC-K01', '02-detail-du-retour');

  // COD bloqué : l'argent que le marchand n'a pas touché parce que la course a échoué.
  const codBloque = sql(`SELECT COALESCE(SUM(o.cod),0) FROM tenant_rabatexpress.orders o
                         JOIN tenant_rabatexpress.returns r ON r.ref = o.ref
                         WHERE r.status <> 'RENDU'`).trim();
  console.log(`  COD bloqué attendu → ${codBloque} DH`);
  if (Number(codBloque) > 0) expect(detail).toContain('COD bloqué');
});
