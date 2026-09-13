import { test, expect } from '@playwright/test';
import { attendreLigne, loginSaas, loginTenant, motDePasse, nextAlert, shotVp, sql } from './helpers';

// TC-A23 — Expiration de l'essai : forcer l'échéance en base (trial_ends_at = hier) sur
// atlasfret, puis Lancer le cycle → abonnement Impayé, bandeau orange, accès tenant OUVERT.
// (Idempotent : si un run précédent a déjà fait passer l'essai à Impayé, on vérifie l'état.)
const SUB_ATLAS = `SELECT s.status FROM platform.subscriptions s
  JOIN platform.tenants t ON t.id = s.tenant_id WHERE t.slug='atlasfret' AND s.ended_at IS NULL`;

test('TC-A23 — Expiration de l’essai', async ({ page }) => {
  test.setTimeout(180_000);

  if (sql(SUB_ATLAS) === 'ESSAI') {
    // Forçage hors périmètre UI (préparation documentée par le plan).
    sql(`UPDATE platform.subscriptions SET trial_ends_at = current_date - 1
         WHERE tenant_id = (SELECT id FROM platform.tenants WHERE slug='atlasfret') AND ended_at IS NULL`);
    await loginSaas(page);
    const alertMsg = nextAlert(page);
    await page.getByRole('button', { name: 'Lancer le cycle' }).click();
    const msg = await alertMsg;
    console.log(`cycle → ${msg.replace(/\n/g, ' | ')}`);
    expect(msg).toContain('1 essai(s) expiré(s)');
    await page.reload();
  } else {
    console.log(`atlasfret déjà en statut ${sql(SUB_ATLAS)} — vérification de l'état.`);
    await loginSaas(page);
  }

  // Abonnement Impayé + bandeau orange.
  // NB : accès à la ligne par locator DOM et non par rôle — après la fermeture d'un
  // dialogue, le conteneur racine garde `aria-hidden="true"` (défaut AN-12) et vide
  // l'arbre d'accessibilité, ce qui rend `getByRole('row')` introuvable.
  const row = await attendreLigne(page, 'atlasfret', 'Impayé');
  await expect(row.getByText('Impayé', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText('impayé depuis');
  await expect(page.getByText(/abonnement\(s\) impayé\(s\)/)).toBeVisible();
  await shotVp(page, 'TC-A23', '01-atlasfret-impaye-bandeau-orange');

  // L'accès du tenant reste ouvert : connexion admin possible.
  const err = await loginTenant(page, 'atlasfret', 'admin@atlasfret.ma', motDePasse('admin@atlasfret.ma'));
  expect(err).toBeNull();
  await shotVp(page, 'TC-A23', '02-connexion-tenant-impaye-ouverte');
});
