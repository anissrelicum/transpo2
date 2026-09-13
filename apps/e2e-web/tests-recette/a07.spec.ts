import { test, expect } from '@playwright/test';
import { loginSaas, shot, sql, nbTenants } from './helpers';

// TC-A07 — Recherche et filtre.
// Le cas d'origine figeait un parc de deux organisations. Il juge désormais en RELATIF :
// une recherche isole, un filtre de statut donne exactement le décompte de la base, et
// vider les critères restaure le parc complet. La règle testée est la même, elle survit
// juste au fait que le parc grossit.
test('TC-A07 — Recherche et filtre', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);

  const search = page.getByPlaceholder(/Rechercher/);
  const rows = page.locator('table tbody tr');
  const parc = nbTenants();
  await expect(rows).toHaveCount(parc);

  // Recherche sur un slug repère : elle isole cette seule organisation.
  const repere = sql("select slug from platform.tenants order by slug limit 1");
  console.log(`parc → ${parc} organisation(s) · repère → ${repere}`);
  await search.fill(repere);
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole('row', { name: new RegExp(repere) })).toBeVisible();
  await shot(page, 'TC-A07', '01-recherche-isole-une-ligne');

  // Une recherche sans correspondance est ANNONCÉE, pas rendue par un tableau vide.
  await search.fill('zzz-introuvable');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Aucune organisation ne correspond au filtre.')).toBeVisible();
  await shot(page, 'TC-A07', '02-recherche-sans-resultat');

  // Vider le champ restaure le parc complet.
  await search.fill('');
  await expect(rows).toHaveCount(parc);
  await shot(page, 'TC-A07', '03-champ-vide-parc-complet');

  // Filtre par statut : chaque statut affiche exactement ce que porte la base.
  const statuts: Array<[string, string]> = [
    ['Essai', 'ESSAI'], ['Actif', 'ACTIF'], ['Impayé', 'IMPAYE'],
    ['Suspendu', 'SUSPENDU'], ['Résilié', 'RESILIE'],
  ];
  let i = 4;
  for (const [libelle, code] of statuts) {
    const attendu = Number(sql(
      `select count(*) from platform.subscriptions s join platform.tenants t on t.id = s.tenant_id
        where s.ended_at is null and s.status = '${code}'`,
    ));
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: libelle, exact: true }).click();
    console.log(`filtre ${libelle} → ${attendu} attendue(s)`);
    await expect(rows).toHaveCount(attendu);
    if (attendu === 0) {
      await expect(page.getByText('Aucune organisation ne correspond au filtre.')).toBeVisible();
    }
    await shot(page, 'TC-A07', `0${i}-filtre-statut-${libelle.toLowerCase().replace('é', 'e')}`);
    i++;
  }

  // Retour à « Tous statuts » → parc complet.
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Tous statuts' }).click();
  await expect(rows).toHaveCount(parc);
  await shot(page, 'TC-A07', '09-tous-statuts-parc-complet');
});
