import { test, expect } from '@playwright/test';
import { loginSaas, shot, sql, nbTenants } from './helpers';

// TC-A10 — Facturation plateforme (/saas/billing) : une ligne par organisation, montant
// cohérent avec le plan RÉELLEMENT souscrit, et une organisation en essai non facturée.
//
// Le cas d'origine comparait à des montants écrits en dur (2 499 DH). Ils ont changé dès
// qu'une nouvelle version de plan a été publiée (TC-A16) : le cas tombait alors que le
// produit avait raison. La vérification se fait désormais contre le catalogue lui-même.
test('TC-A10 — Facturation plateforme', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);
  await page.goto('/saas/billing');
  await expect(page.getByRole('heading', { name: 'Facturation plateforme' })).toBeVisible();

  // Une ligne par organisation du parc.
  await expect(page.locator('table tbody tr')).toHaveCount(nbTenants());

  // Pour chaque organisation : plan, statut, et montant conforme au tarif courant du plan.
  // L'écran affiche le statut du TENANT (accès), pas celui de l'abonnement : un impayé
  // reste ACTIF côté accès, par choix métier (relance, pas coupure). Cf. le constat
  // consigné avec ce cas sur ce que devrait montrer un écran de facturation.
  const lignes = sql(`
    SELECT t.slug, t.status, s.status, p.label_fr, pv.monthly_centimes
      FROM platform.tenants t
      JOIN platform.subscriptions s ON s.tenant_id = t.id AND s.ended_at IS NULL
      JOIN platform.plan_versions pv ON pv.id = s.plan_version_id
      JOIN platform.plans p ON p.id = pv.plan_id
     ORDER BY t.slug`);
  console.log(`abonnements en base :\n${lignes}`);

  for (const l of lignes.split('\n').filter(Boolean)) {
    const [slug, statutTenant, statutAbo, plan, centimes] = l.split(' | ');
    const ligne = page.getByRole('row', { name: new RegExp(slug) });
    await expect(ligne).toContainText(plan);
    await expect(ligne).toContainText(statutTenant);
    if (statutAbo === 'ESSAI') {
      // Un essai ne se facture pas : le montant est un tiret, pas un zéro trompeur.
      await expect(ligne).toContainText('—');
    } else {
      const dh = Math.round(Number(centimes) / 100);
      const attendu = dh.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
      console.log(`${slug} · ${plan} · ${statutTenant} → attendu ${attendu} DH`);
      await expect(ligne).toContainText(attendu);
    }
  }
  await shot(page, 'TC-A10', '01-facturation-plateforme');
});
