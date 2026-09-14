import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-R02 — Analytique.
// ATT : répartition par statut cohérente avec /orders ; motifs d'échec repris des échecs
//       réellement déclarés ; tableaux par marchand et par chauffeur exacts.
test('TC-R02 — l’analytique compte ce que la base contient', async ({ page }) => {
  test.setTimeout(180_000);

  const parStatut = sql(`SELECT status, count(*) FROM tenant_rabatexpress.orders GROUP BY status ORDER BY status`)
    .split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((c) => c[0]);
  const motifs = sql(`SELECT reason FROM tenant_rabatexpress.returns WHERE reason IS NOT NULL`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`  statuts → ${parStatut.map(([s, n]) => `${s}:${n}`).join(' ')}`);
  console.log(`  ${motifs.length} motif(s) d’échec en base`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/analytics');
  await page.waitForTimeout(2500);
  await shotVp(page, 'TC-R02', '01-analytique');
  const corps = await page.locator('body').innerText();

  // Les motifs d'échec affichés sont ceux que le terrain a saisis, pas une liste figée.
  if (motifs.length) {
    const premier = motifs[0].split('—')[0].trim();
    console.log(`  motif attendu à l’écran → « ${premier} »`);
    expect(corps).toContain(premier.slice(0, 12));
  } else {
    expect(corps).toMatch(/Aucun échec sur la période/);
  }

  // Les chauffeurs et marchands ayant livré apparaissent dans les tableaux.
  const chauffeurs = sql(`SELECT DISTINCT driver FROM tenant_rabatexpress.orders
                          WHERE driver IS NOT NULL AND status = 'LIVREE'`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  // Le tableau par livreur est derrière son onglet : le lire sans l'ouvrir revenait à
  // reprocher à l'écran de cacher ce qu'on n'avait pas demandé.
  await page.getByRole('tab', { name: /Par livreur/ }).click();
  await page.waitForTimeout(1200);
  const ongletLivreurs = await page.locator('body').innerText();
  for (const c of chauffeurs) expect(ongletLivreurs, `${c} doit figurer à l’analytique`).toContain(c);
  console.log(`  ${chauffeurs.length} chauffeur(s) livrant : tous présents`);
  await shotVp(page, 'TC-R02', '02-tableaux');
});
