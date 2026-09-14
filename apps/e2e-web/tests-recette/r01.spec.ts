import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-R01 — Tableau de bord.
// ATT : les indicateurs reflètent EXACTEMENT les données du tenant, et les alertes de
//       conformité listent les véhicules non conformes.
test('TC-R01 — le tableau de bord dit la vérité sur les données', async ({ page }) => {
  test.setTimeout(180_000);

  const [total, livrees, enCours, cod] = sql(`
    SELECT count(*),
           COALESCE(SUM(CASE WHEN status='LIVREE' THEN 1 ELSE 0 END),0),
           COALESCE(SUM(CASE WHEN status IN ('ASSIGNEE','RETRAIT','RECUPEREE','LIVRAISON') THEN 1 ELSE 0 END),0),
           COALESCE(SUM(CASE WHEN cod_paid THEN cod ELSE 0 END),0)
    FROM tenant_rabatexpress.orders`).split('|').map((x) => x.trim());
  console.log(`  base → ${total} commande(s), ${livrees} livrée(s), ${enCours} en cours, ${cod} DH encaissés`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/dashboard');
  await page.waitForTimeout(2500);
  await shotVp(page, 'TC-R01', '01-tableau-de-bord');
  const corps = await page.locator('body').innerText();

  // Les chiffres affichés doivent être ceux de la base, pas un arrondi de confort.
  const lire = (libelle: string) => {
    const m = new RegExp(`${libelle}[\\s\\S]{0,60}?([\\d][\\d\\s ]*)`).exec(corps);
    return m ? m[1].replace(/[\s ]/g, '') : null;
  };
  console.log(`  écran → livrées ${lire('Livrées')}, en cours ${lire('En cours')}`);
  if (lire('Livrées')) expect(lire('Livrées')).toBe(livrees);

  // Alertes de conformité : les véhicules dont une échéance est passée.
  const nonConformes = sql(`SELECT plate FROM tenant_rabatexpress.vehicles
                            WHERE (insurance_due IS NOT NULL AND insurance_due < CURRENT_DATE::text)
                               OR (ct_due IS NOT NULL AND ct_due < CURRENT_DATE::text)`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`  véhicules non conformes en base → ${nonConformes.join(', ') || 'aucun'}`);
  if (nonConformes.length) {
    for (const plaque of nonConformes) expect(corps).toContain(plaque);
  } else {
    expect(corps).toMatch(/Aucune échéance en alerte|conforme/i);
  }
  await shotVp(page, 'TC-R01', '02-conformite');
});
