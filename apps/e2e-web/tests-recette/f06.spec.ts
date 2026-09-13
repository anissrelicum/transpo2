import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql } from './helpers';

// TC-F06 — Transition invalide refusée.
// PAS : appeler directement l'API pour sauter des étapes, et pour déclarer une livraison
//       depuis la console.
// ATT : refus — seul le pas suivant du cycle nominal est autorisé, et la clôture d'une
//       livraison passe par la preuve (app livreur), pas par la console.
test('TC-F06 — transitions invalides refusées par l’API', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/orders');

  const neuve = sql(`SELECT ref FROM tenant_rabatexpress.orders WHERE status='NOUVELLE' ORDER BY created_at LIMIT 1`);
  const enLivraison = sql(`SELECT ref FROM tenant_rabatexpress.orders WHERE status='LIVRAISON' ORDER BY created_at LIMIT 1`);
  console.log(`nouvelle → ${neuve} · en livraison → ${enLivraison}`);
  expect(neuve).toMatch(/^CMD-/);
  expect(enLivraison).toMatch(/^CMD-/);

  const resultats = await page.evaluate(async ({ neuve, enLivraison }) => {
    const appel = async (ref: string, action: string) => {
      const r = await fetch(`/api/orders/${encodeURIComponent(ref)}/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    };
    return {
      // Une commande Nouvelle avance d'UN pas : on ne saute pas à la livraison.
      pasSuivant: await appel(neuve, 'advance'),
      // Et la clôture d'une livraison ne se fait pas depuis la console.
      cloture: await appel(enLivraison, 'advance'),
    };
  }, { neuve, enLivraison });

  console.log(`Nouvelle + advance → ${resultats.pasSuivant.status}`);
  console.log(`LIVRAISON + advance → ${resultats.cloture.status} ${JSON.stringify(resultats.cloture.body)}`);

  // Le pas nominal suivant reste permis : la règle borne, elle ne bloque pas.
  expect(resultats.pasSuivant.status).toBe(200);
  expect(sql(`SELECT status FROM tenant_rabatexpress.orders WHERE ref='${neuve}'`)).toBe('ASSIGNEE');

  // La livraison, elle, exige la preuve.
  expect(resultats.cloture.status).toBe(400);
  expect(JSON.stringify(resultats.cloture.body)).toContain('preuve');
  expect(sql(`SELECT status FROM tenant_rabatexpress.orders WHERE ref='${enLivraison}'`)).toBe('LIVRAISON');
  await shotVp(page, 'TC-F06', '01-transitions-refusees');

  // Aucune commande n'a pu passer LIVREE sans preuve.
  const livrees = sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE status='LIVREE'`);
  console.log(`commandes livrées → ${livrees}`);
  expect(Number(livrees)).toBe(0);
});
