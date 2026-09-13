import { test, expect } from '@playwright/test';
import { loginSaas, shotVp, sql } from './helpers';

// TC-A11 — Catalogue des plans (/saas/plans) : chaque plan affiche son tarif et son quota,
// et la colonne Abonnés reflète la répartition réelle du parc.
//
// Le cas d'origine exigeait exactement 4 plans : il tombait dès que la recette en publiait
// un cinquième (TC-A13). Le décompte se lit désormais en base — ce qui compte, c'est que le
// catalogue affiché soit celui qui existe, pas qu'il ait une taille donnée.
test('TC-A11 — Catalogue des plans', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  const attendus = Number(sql('select count(*) from platform.plans where archived_at is null'));
  console.log(`plans au catalogue → ${attendus}`);
  const rows = page.locator('table tbody tr');
  await expect(rows).toHaveCount(attendus);
  // Chaque plan affiche le tarif et le quota de sa DERNIÈRE version publiée — y compris
  // lorsqu'elle n'est pas encore en vigueur (cf. constat OBS-12). Les montants ne sont pas
  // écrits dans le cas : une version publiée en cours de recette (TC-A16) les change.
  const catalogue = sql(`
    SELECT p.label_fr, pv.billing_mode, pv.monthly_centimes, coalesce(pv.included_orders::text, 'illimite')
      FROM platform.plans p
      JOIN platform.plan_versions pv ON pv.plan_id = p.id
     WHERE p.archived_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM platform.plan_versions pv2
          WHERE pv2.plan_id = p.id AND pv2.effective_from > pv.effective_from)
     ORDER BY p.label_fr`);
  console.log(`catalogue courant :\n${catalogue}`);

  const fr = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
  for (const l of catalogue.split('\n').filter(Boolean)) {
    const [plan, mode, centimes, quota] = l.split(' | ');
    const ligne = page.getByRole('row', { name: new RegExp(plan) }).first();
    if (mode === 'FORFAIT') {
      const dh = Math.round(Number(centimes) / 100);
      await expect(ligne).toContainText(dh === 0 ? 'Gratuit' : `${fr(dh)} DH/mois`);
      await expect(ligne).toContainText(
        quota === 'illimite' ? 'Commandes illimitées' : `${fr(Number(quota))} cmd/mois`,
      );
    } else {
      // Plan à l'usage : pas de mensualité, un tarif par commande et des paliers.
      await expect(ligne).toContainText('À l’usage');
      await expect(ligne).toContainText('paliers');
    }
  }
  await shotVp(page, 'TC-A11', '01-catalogue-des-plans');

  // Répartition du parc (colonne Abonnés) : confrontée aux abonnements réels.
  const parc = sql(`
    SELECT p.label_fr, count(s.id)
      FROM platform.plans p
      LEFT JOIN platform.plan_versions pv ON pv.plan_id = p.id
      LEFT JOIN platform.subscriptions s ON s.plan_version_id = pv.id AND s.ended_at IS NULL
     WHERE p.archived_at IS NULL
     GROUP BY p.label_fr ORDER BY p.label_fr`);
  console.log(`répartition du parc :\n${parc}`);
  for (const l of parc.split('\n').filter(Boolean)) {
    const [plan, abonnes] = l.split(' | ');
    await expect(page.getByRole('row', { name: new RegExp(plan) }).first()).toContainText(abonnes);
  }
  await shotVp(page, 'TC-A11', '02-repartition-du-parc');
});
