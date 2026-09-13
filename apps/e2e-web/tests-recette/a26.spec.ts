import { test, expect } from '@playwright/test';
import { attendreLigne, loginSaas, loginTenant, motDePasse, openTenantMenu, shotVp, sql } from './helpers';

// TC-A26 — Régularisation : sur l'abonnement suspendu d'atlasfret, menu → Réactiver.
// ATT : retour en Actif sur la période courante, motif effacé, connexion au tenant rétablie.
test('TC-A26 — Régularisation', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);

  // NB : accès à la ligne par locator DOM et non par rôle — après la fermeture d'un
  // dialogue, le conteneur racine garde `aria-hidden="true"` (défaut AN-12) et vide
  // l'arbre d'accessibilité, ce qui rend `getByRole('row')` introuvable.
  // Précondition : A24 a suspendu atlasfret.
  const row = await attendreLigne(page, 'atlasfret', 'Suspendu');
  await shotVp(page, 'TC-A26', '01-avant-suspendu');

  await openTenantMenu(page, 'atlasfret');
  await page.getByRole('menuitem', { name: 'Réactiver' }).click();

  // Retour Actif sur la période courante, motif effacé.
  await attendreLigne(page, 'atlasfret', 'Actif');
  await expect(row).toContainText('échéance');
  await expect(row).not.toContainText('suspendu après délai de grâce');
  const sub = sql(`SELECT s.status || '|' || COALESCE(s.status_reason,'-') FROM platform.subscriptions s
    JOIN platform.tenants t ON t.id = s.tenant_id WHERE t.slug='atlasfret' AND s.ended_at IS NULL`);
  expect(sub).toBe('ACTIF|-');
  await shotVp(page, 'TC-A26', '02-apres-actif-motif-efface');

  // Connexion au tenant rétablie.
  const err = await loginTenant(page, 'atlasfret', 'admin@atlasfret.ma', motDePasse('admin@atlasfret.ma'));
  expect(err).toBeNull();
  await shotVp(page, 'TC-A26', '03-connexion-retablie');
});
