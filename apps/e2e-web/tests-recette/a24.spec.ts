import { test, expect } from '@playwright/test';
import { loginSaas, loginTenant, motDePasse, nextAlert, shotVp, sql } from './helpers';

// TC-A24 — Suspension après le délai de grâce : 7 jours pleins doivent s'être écoulés.
// past_due_since à -6 → rien ; à -8 → Suspendu, tenants.status suit, connexion refusée.
const SUB = `SELECT s.status FROM platform.subscriptions s
  JOIN platform.tenants t ON t.id = s.tenant_id WHERE t.slug='atlasfret' AND s.ended_at IS NULL`;
const setPastDue = (days: number) =>
  sql(`UPDATE platform.subscriptions SET past_due_since = current_date - ${days}
       WHERE tenant_id = (SELECT id FROM platform.tenants WHERE slug='atlasfret') AND ended_at IS NULL`);

test('TC-A24 — Suspension après le délai de grâce', async ({ page }) => {
  test.setTimeout(180_000);
  await loginSaas(page);
  const cycle = async () => {
    const alertMsg = nextAlert(page);
    await page.getByRole('button', { name: 'Lancer le cycle' }).click();
    const msg = await alertMsg;
    console.log(`cycle → ${msg.replace(/\n/g, ' | ')}`);
    await page.reload();
    return msg;
  };

  // À -6 jours : rien ne se passe (7 jours pleins requis).
  if (sql(SUB) === 'IMPAYE') {
    setPastDue(6);
    const msg6 = await cycle();
    expect(msg6).toContain('0 suspension(s)');
    expect(sql(SUB)).toBe('IMPAYE');
    await expect(page.locator('tr', { hasText: 'atlasfret' }).first().getByText('Impayé', { exact: true }))
      .toBeVisible({ timeout: 30_000 });
    await shotVp(page, 'TC-A24', '01-moins-6-jours-toujours-impaye');
    const err6 = await loginTenant(page, 'atlasfret', 'admin@atlasfret.ma', motDePasse('admin@atlasfret.ma'));
    expect(err6).toBeNull();
    await shotVp(page, 'TC-A24', '02-connexion-ok-a-moins-6');
    await loginSaas(page); // la connexion tenant a remplacé la session super-admin
  }

  // À -8 jours : suspension.
  setPastDue(8);
  const msg8 = await cycle();
  expect(msg8).toContain('1 suspension(s)');
  expect(sql(SUB)).toBe('SUSPENDU');
  const tenantStatus = sql("SELECT status FROM platform.tenants WHERE slug='atlasfret'");
  expect(tenantStatus).toBe('SUSPENDU');
  // NB : accès à la ligne par locator DOM et non par rôle — après la fermeture d'un
  // dialogue, le conteneur racine garde `aria-hidden="true"` (défaut AN-12) et vide
  // l'arbre d'accessibilité, ce qui rend `getByRole('row')` introuvable.
  const row = page.locator('tr', { hasText: 'atlasfret' }).first();
  await expect(row.getByText('Suspendu', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/organisation\(s\) sans accès/)).toBeVisible();
  await shotVp(page, 'TC-A24', '03-moins-8-jours-suspendu');

  // Connexion au tenant refusée.
  const err8 = await loginTenant(page, 'atlasfret', 'admin@atlasfret.ma', motDePasse('admin@atlasfret.ma'));
  console.log(`connexion suspendue → ${err8}`);
  expect(err8).not.toBeNull();
  await shotVp(page, 'TC-A24', '04-connexion-refusee-suspendu');
});
