import { test, expect } from '@playwright/test';
import { loginSaas, loginTenant, motDePasse, openTenantMenu, shotVp, sql } from './helpers';

// TC-A27 — Résiliation : menu → Résilier, motif obligatoire, confirmer.
// ATT : l'abonnement disparaît des abonnements courants, le tenant est sans accès, et une
// nouvelle souscription redevient possible via « Souscrire / changer de plan ».
// (La re-souscription est vérifiée sans être exécutée : atlasfret doit rester RÉSILIE pour TC-A28.)
test('TC-A27 — Résiliation', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);

  // Motif obligatoire : le bouton Résilier du dialogue est désactivé tant qu'il est vide.
  await openTenantMenu(page, 'atlasfret');
  await page.getByRole('menuitem', { name: 'Résilier' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText(/Résilier l’abonnement de Atlas Fret/)).toBeVisible();
  const boutonResilier = confirm.getByRole('button', { name: 'Résilier' });
  await expect(boutonResilier).toBeDisabled();
  await shotVp(page, 'TC-A27', '01-motif-obligatoire-bouton-desactive');

  await confirm.locator('input').fill('Fin de la recette A-ter');
  await expect(boutonResilier).toBeEnabled();
  await boutonResilier.click();
  await page.reload();

  // L'abonnement disparaît des abonnements courants, le tenant est sans accès.
  const row = page.getByRole('row', { name: /atlasfret/ });
  await expect(row.getByText('Aucun abonnement')).toBeVisible({ timeout: 30_000 });
  const sub = sql(`SELECT count(*) FROM platform.subscriptions s
    JOIN platform.tenants t ON t.id = s.tenant_id WHERE t.slug='atlasfret' AND s.ended_at IS NULL`);
  expect(sub).toBe('0');
  const clos = sql(`SELECT s.status FROM platform.subscriptions s
    JOIN platform.tenants t ON t.id = s.tenant_id WHERE t.slug='atlasfret' ORDER BY s.created_at DESC LIMIT 1`);
  expect(clos).toBe('RESILIE');
  await shotVp(page, 'TC-A27', '02-abonnement-clos-aucun-abonnement');

  const err = await loginTenant(page, 'atlasfret', 'admin@atlasfret.ma', motDePasse('admin@atlasfret.ma'));
  console.log(`connexion résiliée → ${err}`);
  expect(err).not.toBeNull();
  await shotVp(page, 'TC-A27', '03-connexion-refusee-resilie');

  // Une nouvelle souscription redevient possible (dialogue disponible et validable) — non exécutée.
  await loginSaas(page);
  await openTenantMenu(page, 'atlasfret');
  await page.getByRole('menuitem', { name: /Souscrire \/ changer de plan/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Atlas Fret/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Valider' })).toBeEnabled();
  await shotVp(page, 'TC-A27', '04-resouscription-possible');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
});
