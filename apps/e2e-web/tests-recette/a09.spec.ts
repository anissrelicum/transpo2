import { test, expect } from '@playwright/test';
import { loginSaas, openTenantMenu, shot } from './helpers';

// TC-A09 — Changement de plan à l'échéance :
// 1. choisir le plan déjà en cours sans la case → Valider désactivé ;
// 2. Transporteur sans la case → plan courant inchangé, « → Transporteur à l'échéance » ;
// 3. cocher « Appliquer immédiatement » → changement tout de suite.
// (Retour à Entreprise en fin de cas pour préserver l'état attendu par TC-A11.)
// Note : le router.refresh() post-action est lent sur le homelab → reload avant chaque contrôle.
test('TC-A09 — Changement de plan à l’échéance', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);
  const row = () => page.getByRole('row', { name: /rabatexpress/ });

  // 1. Plan déjà en cours (Entreprise), sans la case → Valider désactivé.
  await openTenantMenu(page, 'rabatexpress');
  await page.getByRole('menuitem', { name: /Souscrire \/ changer de plan/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/prochaine échéance/)).toBeVisible();
  const valider = dialog.getByRole('button', { name: 'Valider' });
  await expect(valider).toBeDisabled();
  await shot(page, 'TC-A09', '01-plan-en-cours-valider-desactive');

  // 2. Transporteur à l'échéance : le plan courant ne change pas.
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: /Transporteur/ }).click();
  await expect(valider).toBeEnabled();
  await shot(page, 'TC-A09', '02-transporteur-selectionne-a-echeance');
  await valider.click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(row()).toContainText('à l’échéance', { timeout: 30_000 });
  await expect(row()).toContainText('Entreprise');
  await shot(page, 'TC-A09', '03-plan-courant-inchange-changement-a-echeance');

  // 3. Appliquer immédiatement → le changement est effectif tout de suite.
  await openTenantMenu(page, 'rabatexpress');
  await page.getByRole('menuitem', { name: /Souscrire \/ changer de plan/ }).click();
  await expect(dialog.getByText(/prochaine échéance/)).toBeVisible();
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: /Transporteur/ }).click();
  await dialog.locator('input[type="checkbox"]').check();
  await shot(page, 'TC-A09', '04-appliquer-immediatement-coche');
  await valider.click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(row()).toContainText('Transporteur', { timeout: 30_000 });
  await expect(row()).not.toContainText('à l’échéance');
  await shot(page, 'TC-A09', '05-changement-immediat-transporteur');

  // Restauration : retour à Entreprise (immédiat) pour l'état attendu par TC-A11.
  await openTenantMenu(page, 'rabatexpress');
  await page.getByRole('menuitem', { name: /Souscrire \/ changer de plan/ }).click();
  await expect(dialog.getByText(/prochaine échéance/)).toBeVisible();
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: /Entreprise/ }).click();
  await dialog.locator('input[type="checkbox"]').check();
  await valider.click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(row()).toContainText('Entreprise', { timeout: 30_000 });
  await expect(row()).not.toContainText('à l’échéance');
  await shot(page, 'TC-A09', '06-retour-entreprise');
});
