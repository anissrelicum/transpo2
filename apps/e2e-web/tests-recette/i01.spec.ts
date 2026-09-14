import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-I01 — Créer une tournée.
// ATT : tournée au statut Planifiée, arrêts dans l'ordre de sélection, COD total juste.
test('TC-I01 — créer une tournée de trois arrêts', async ({ page }) => {
  test.setTimeout(180_000);

  // Décor : trois commandes non affectées, avec des COD connus, et aucune tournée du jour.
  const jour = new Date().toISOString().slice(0, 10);
  sql(`DELETE FROM tenant_rabatexpress.tournees WHERE day = '${jour}'`);
  sql(`UPDATE tenant_rabatexpress.orders SET driver = NULL, status = 'NOUVELLE'
       WHERE ref IN (SELECT ref FROM tenant_rabatexpress.orders
                     WHERE status NOT IN ('ANNULEE','RETOUR','LIVREE') ORDER BY created_at DESC LIMIT 3)`);
  const libres = sql(`SELECT ref, cod FROM tenant_rabatexpress.orders WHERE driver IS NULL AND status = 'NOUVELLE'`)
    .split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((c) => c[0]);
  expect(libres.length, 'trois commandes libres attendues').toBeGreaterThanOrEqual(3);
  const choisies = libres.slice(0, 3);
  const codAttendu = choisies.reduce((s, [, cod]) => s + Number(cod), 0);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/tournees');
  await shotVp(page, 'TC-I01', '01-tournees');

  await page.getByRole('button', { name: 'Nouvelle tournée' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Hamid Ouali' }).click();
  await dlg.getByPlaceholder('AAAA-MM-JJ').fill(jour);
  for (const [ref] of choisies) await dlg.getByText(ref, { exact: false }).first().click();
  await expect(dlg.getByText(`Commandes à inclure (${choisies.length})`)).toBeVisible();
  await shotVp(page, 'TC-I01', '02-tournee-saisie');
  await dlg.getByRole('button', { name: 'Créer' }).click();
  await expect(dlg).toBeHidden({ timeout: 20_000 });

  // La tournée existe, planifiée, avec ses arrêts dans l'ordre de sélection.
  const ligne = sql(`SELECT status, stops FROM tenant_rabatexpress.tournees WHERE day = '${jour}' ORDER BY created_at DESC LIMIT 1`);
  const [statut, stops] = ligne.split('|').map((x) => x.trim());
  console.log(`  tournée créée → ${statut}, arrêts ${stops}`);
  expect(statut).toBe('PLANIFIEE');
  for (const [ref] of choisies) expect(stops).toContain(ref);
  const ordreBase = choisies.map(([ref]) => ref);
  expect(stops.replace(/[{}"]/g, '').split(',')).toEqual(ordreBase);

  // Et à l'écran : statut, arrêts, COD total à collecter.
  await page.reload();
  await expect(page.getByText('Planifiée').first()).toBeVisible({ timeout: 20_000 });
  const corps = await page.locator('body').innerText();
  for (const [ref] of choisies) expect(corps).toContain(ref);
  console.log(`  COD total attendu ${codAttendu} DH`);
  expect(corps).toMatch(new RegExp(String(codAttendu).replace(/(\d)(?=(\d{3})+$)/g, '$1\\s?')));
  await shotVp(page, 'TC-I01', '03-tournee-creee');

  // Les commandes sont affectées au livreur : une tournée n'est pas qu'une liste.
  const affectees = sql(`SELECT count(*) FROM tenant_rabatexpress.orders
                         WHERE driver = 'Hamid Ouali' AND ref IN (${ordreBase.map((r) => `'${r}'`).join(',')})`).trim();
  expect(affectees).toBe('3');
});
