import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-H04 — Manifeste de transfert.
// ATT : liste des colis du quai, total COD embarqué correct, « Sceller le bordereau »
//       ferme le dialogue.
// CONSTAT attendu au-delà du cas : sceller ne laisse AUCUNE trace (cf. rapport, AN-37).
test('TC-H04 — manifeste de transfert d’une destination', async ({ page }) => {
  test.setTimeout(180_000);

  // Décor : deux colis sur quai pour Casablanca, avec des COD connus.
  sql(`UPDATE tenant_rabatexpress.orders SET hub_phase = NULL`);
  const refs = sql(`
    UPDATE tenant_rabatexpress.orders SET status = 'RECUPEREE', hub_phase = 'quai', to_city = 'Casablanca'
    WHERE ref IN (SELECT ref FROM tenant_rabatexpress.orders
                  WHERE status NOT IN ('ANNULEE','RETOUR','LIVREE') ORDER BY created_at DESC LIMIT 2)
    RETURNING ref`).split('\n').map((l) => l.trim()).filter(Boolean);
  expect(refs.length, 'deux colis doivent être sur quai').toBe(2);
  const totalAttendu = Number(sql(
    `SELECT COALESCE(SUM(cod),0) FROM tenant_rabatexpress.orders WHERE hub_phase = 'quai'`).trim());

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/hub');
  await expect(page.getByRole('heading', { name: 'Tri en hub' })).toBeVisible();
  await shotVp(page, 'TC-H04', '01-quai-casablanca');

  await page.getByRole('button', { name: 'Manifeste' }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Manifeste de transfert → Casablanca')).toBeVisible();

  // Chaque colis du quai figure au bordereau, avec sa référence.
  for (const ref of refs) await expect(dlg.getByText(ref)).toBeVisible();
  await expect(dlg.getByText(`${refs.length} colis · COD embarqué`)).toBeVisible();

  // Le total embarqué est celui des colis listés — c'est l'argent qui part sur la route.
  const texte = await dlg.innerText();
  const montants = [...texte.matchAll(/([\d\s  ]+),\d{2}\s*DH/g)].map((m) => Number(m[1].replace(/[\s ]/g, '')));
  const total = montants.at(-1);
  console.log(`  manifeste → ${refs.length} colis, total affiché ${total} DH (attendu ${totalAttendu})`);
  expect(total).toBe(totalAttendu);
  await shotVp(page, 'TC-H04', '02-manifeste');

  await dlg.getByRole('button', { name: 'Sceller le bordereau' }).click();
  await expect(dlg).toBeHidden();
  await shotVp(page, 'TC-H04', '03-bordereau-scelle');

  // Ce que le cas RÉVÈLE : après scellement, les colis sont toujours sur quai et rien
  // n'a été enregistré. Le bordereau peut être scellé indéfiniment, sans trace.
  const encoreSurQuai = sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE hub_phase = 'quai'`).trim();
  console.log(`  après scellement → ${encoreSurQuai} colis toujours sur quai (aucune trace de transfert)`);
  expect(encoreSurQuai).toBe(String(refs.length));
});
