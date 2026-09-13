import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql } from './helpers';

// TC-F03 — Assignation depuis le dispatch (score).
// PAS : /dispatch → une commande non affectée → Affecter.
// ATT : chauffeurs classés par score /100 avec le détail Zone /40 + Dispo /30 + Charge /30 ;
//       le 1ᵉʳ porte le badge Recommandé ; un chauffeur indisponible ou non conforme
//       n'apparaît pas. Choisir → la commande passe en Assignée.
test('TC-F03 — assignation par score depuis le dispatch', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();

  // Décor : Sara Bennis est laissée indisponible par TC-D10 — elle ne doit pas être proposée.
  const effectif = sql(`SELECT name, available FROM tenant_rabatexpress.drivers ORDER BY name`);
  console.log(`effectif → ${effectif.replace(/\n/g, ' | ')}`);
  expect(effectif).toContain('Sara Bennis | f');

  await page.goto('/dispatch');
  await expect(page.getByText('Non affectées')).toBeVisible();
  await shotVp(page, 'TC-F03', '01-colonne-non-affectees');

  await page.getByRole('button', { name: 'Affecter' }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Recommandé')).toBeVisible({ timeout: 20_000 });
  // Détail du score : le barème est rappelé, et les trois composantes chiffrées affichées.
  await expect(dlg.getByText(/zone \(40\) \+ disponibilité \(30\) \+ faible charge \(30\)/)).toBeVisible();
  for (const [composante, max] of [['Zone', 40], ['Dispo', 30], ['Charge', 30]] as const) {
    await expect(dlg.getByText(new RegExp(`${composante} \\d+\\s*/${max}`)).first()).toBeVisible();
  }
  await shotVp(page, 'TC-F03', '02-scores-detailles');

  // Un chauffeur indisponible n'est pas proposé.
  await expect(dlg.getByText('Sara Bennis')).toHaveCount(0);
  await expect(dlg.getByText('Hamid Ouali')).toBeVisible();
  await shotVp(page, 'TC-F03', '03-indisponible-exclu');

  const avant = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE status='ASSIGNEE'`));
  await dlg.getByRole('button', { name: /Choisir/ }).first().click();
  await page.waitForTimeout(2000);
  await page.reload();
  const apres = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE status='ASSIGNEE'`));
  console.log(`commandes assignées : ${avant} → ${apres}`);
  expect(apres).toBe(avant + 1);
  const assignee = sql(`SELECT driver FROM tenant_rabatexpress.orders WHERE status='ASSIGNEE' LIMIT 1`);
  expect(assignee).toBe('Hamid Ouali');
  await shotVp(page, 'TC-F03', '04-commande-assignee');
});
