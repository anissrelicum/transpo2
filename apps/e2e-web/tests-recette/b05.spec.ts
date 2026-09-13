import { test, expect } from '@playwright/test';
import { attendreLigne, loginSaas, loginTenant, openTenantMenu, shotVp, sql } from './helpers';

// TC-B05 — Paywall : organisation suspendue.
// PAS : super-admin → menu de rabatexpress → Suspendre (motif) ; tenter la connexion tenant ;
// réactiver ensuite et vérifier que la connexion repasse.
// ATT : « Espace suspendu — contactez la plateforme. », motif affiché sous le statut.
// Idempotent : si rabatexpress est déjà SUSPENDU (re-run), la suspension UI n'est pas refaite.
const MOTIF = 'Recette B05 — suspension de test';
const SUB = `SELECT status FROM platform.tenants WHERE slug='rabatexpress'`;

// Garde-fou : un echec en cours de route laisserait rabatexpress SUSPENDU et ferait
// tomber les 15 cas suivants sur le paywall. Le verdict du cas reste inchange.
test.afterEach(() => {
  if (sql(SUB) === 'SUSPENDU') {
    sql(`UPDATE platform.subscriptions s SET status='ACTIF', status_reason = NULL
           FROM platform.tenants t WHERE t.id = s.tenant_id AND t.slug='rabatexpress' AND s.ended_at IS NULL`);
    sql(`UPDATE platform.tenants SET status='ACTIF' WHERE slug='rabatexpress'`);
    console.log('TC-B05 garde-fou : rabatexpress reactive apres echec');
  }
});

test('TC-B05 — suspension puis réactivation de rabatexpress', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);

  // 1. Suspendre avec motif (sauf si déjà suspendu — re-run).
  if (sql(SUB) !== 'SUSPENDU') {
    await openTenantMenu(page, 'rabatexpress');
    await page.getByRole('menuitem', { name: 'Suspendre' }).click();
    const dlg = page.getByRole('alertdialog');
    await dlg.getByPlaceholder('Impayé relancé trois fois…').fill(MOTIF);
    await shotVp(page, 'TC-B05', '01-dialogue-suspendre-motif');
    await dlg.getByRole('button', { name: 'Suspendre' }).click();
  }
  // Locator DOM + convergence par rechargement (defaut AN-12 + rafraichissement differe).
  const row = await attendreLigne(page, 'rabatexpress', 'Suspendu');
  await expect(row).toContainText(MOTIF);
  await shotVp(page, 'TC-B05', '02-suspendu-motif-sous-le-statut');

  // 2. Connexion tenant bloquée.
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  console.log(`connexion suspendue → ${err}`);
  expect(err).toContain('Espace suspendu');
  await shotVp(page, 'TC-B05', '03-connexion-refusee-suspendu');

  // 3. Réactiver → la connexion repasse (matrice TC-A28 restaurée).
  await loginSaas(page);
  await openTenantMenu(page, 'rabatexpress');
  await page.getByRole('menuitem', { name: 'Réactiver' }).click();
  const rowActif = await attendreLigne(page, 'rabatexpress', 'Actif');
  await expect(rowActif).not.toContainText(MOTIF);
  await shotVp(page, 'TC-B05', '04-reactive-motif-efface');

  const ok = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(ok).toBeNull();
  await shotVp(page, 'TC-B05', '05-connexion-retablie');
});
