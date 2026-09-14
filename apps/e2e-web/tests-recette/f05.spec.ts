import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-F05 — Progression pas à pas.
// PAS : sur une commande assignée, Faire progresser de façon répétée.
// ATT : Nouvelle → Assignée → En route (retrait) → Récupérée → En route (livraison) ;
//       arrivé à En route (livraison), l'action est DÉSACTIVÉE — la clôture se fait par
//       l'app livreur, avec preuve.
test('TC-F05 — progression pas à pas jusqu’à la livraison en cours', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/orders');

  const ref = sql(`SELECT ref FROM tenant_rabatexpress.orders WHERE status='ASSIGNEE' ORDER BY created_at LIMIT 1`);
  console.log(`commande visée → ${ref}`);
  const ligne = () => page.getByRole('row', { name: new RegExp(ref) });

  const etapes = ['En route (retrait)', 'Récupérée', 'En route (livraison)'];
  for (const [i, attendu] of etapes.entries()) {
    await ligne().getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'Faire progresser' }).click();
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(ligne().getByText(attendu)).toBeVisible({ timeout: 15_000 });
    await shotVp(page, 'TC-F05', `0${i + 1}-${attendu.replace(/[^a-z]+/gi, '-').toLowerCase()}`);
  }

  // Arrivé à « En route (livraison) », l'action n'est plus proposée.
  await ligne().getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Faire progresser' })).toBeDisabled();
  await shotVp(page, 'TC-F05', '04-progression-desactivee');
  await page.keyboard.press('Escape');

  expect(sql(`SELECT status FROM tenant_rabatexpress.orders WHERE ref='${ref}'`)).toBe('LIVRAISON');
});
