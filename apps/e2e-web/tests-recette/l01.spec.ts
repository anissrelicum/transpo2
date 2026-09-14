import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-L01 — Session de caisse alimentée par le terrain.
// PRÉ : des livraisons avec COD encaissé par Hamid Ouali (TC-G07).
// ATT : une session à son nom, COD théorique = somme des COD encaissés, nombre de
//       livraisons juste, statut En cours ou À déposer.
test('TC-L01 — la caisse du livreur se remplit de ses encaissements', async ({ page }) => {
  test.setTimeout(180_000);
  const jour = new Date().toISOString().slice(0, 10);

  const attendu = sql(`
    SELECT COALESCE(SUM(m.amount),0), COUNT(*)
    FROM tenant_rabatexpress.cash_movements m
    JOIN tenant_rabatexpress.cash_sessions s ON s.id = m.session_id
    WHERE s.driver = 'Hamid Ouali' AND s.session_date = '${jour}'`).split('|').map((x) => x.trim());
  console.log(`  mouvements du jour → ${attendu[1]} encaissement(s), ${attendu[0]} DH`);
  expect(Number(attendu[1]), 'TC-G07 doit avoir produit au moins un encaissement').toBeGreaterThan(0);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/cash');
  await expect(page.getByRole('heading', { name: /Caisse|Rapprochement|Cash/i }).first()).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-L01', '01-caisse');

  // La session existe et porte le nom du chauffeur — pas un jeu de démonstration.
  const corps = await page.locator('body').innerText();
  expect(corps).toContain('Hamid Ouali');
  expect(corps).not.toContain('Aucune session de caisse');

  await page.getByText('Hamid Ouali').first().click();
  await page.waitForTimeout(1200);
  await shotVp(page, 'TC-L01', '02-session-du-chauffeur');
  const detail = await page.locator('body').innerText();

  // Le théorique est la somme de ce qui a été réellement encaissé sur le terrain.
  const [theorique, deliveries, statut] = sql(`
    SELECT theorique, deliveries, status FROM tenant_rabatexpress.cash_sessions
    WHERE driver = 'Hamid Ouali' AND session_date = '${jour}'`).split('|').map((x) => x.trim());
  console.log(`  session → théorique ${theorique} DH, ${deliveries} livraison(s), statut ${statut}`);
  expect(theorique).toBe(attendu[0]);
  expect(deliveries).toBe(attendu[1]);
  expect(['EN_COURS', 'A_DEPOSER', 'ECART']).toContain(statut);
  expect(detail).toContain('COD théorique');

  // Et chaque encaissement est traçable à la course près : c'est ce qui permettra de
  // dire d'où vient l'argent quand le déclaré ne tombera pas juste.
  const refs = sql(`SELECT m.ref FROM tenant_rabatexpress.cash_movements m
                    JOIN tenant_rabatexpress.cash_sessions s ON s.id = m.session_id
                    WHERE s.driver = 'Hamid Ouali' AND s.session_date = '${jour}'`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  expect(refs.length).toBe(Number(attendu[1]));
  console.log(`  mouvements rattachés aux courses : ${refs.join(', ')}`);
});
