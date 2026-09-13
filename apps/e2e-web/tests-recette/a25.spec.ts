import { test, expect } from '@playwright/test';
import { loginSaas, nextAlert, shotVp, sql } from './helpers';

// TC-A25 — Rattrapage d'un cron manqué : renews_at 3 mois en arrière sur l'abonnement actif
// de rabatexpress → un seul cycle rattrape mois par mois (aucune période sautée) et renews_at
// repasse dans le futur.
const SUB = `SELECT s.status || '|' || s.current_period || '|' || COALESCE(s.renews_at::text,'-')
  FROM platform.subscriptions s JOIN platform.tenants t ON t.id = s.tenant_id
  WHERE t.slug='rabatexpress' AND s.ended_at IS NULL`;

test('TC-A25 — Rattrapage d’un cron manqué', async ({ page }) => {
  test.setTimeout(180_000);

  const avant = sql(SUB);
  console.log(`avant → ${avant}`);
  await loginSaas(page);

  if (avant === 'ACTIF|2026-09|2026-10-01') {
    sql(`UPDATE platform.subscriptions SET renews_at = DATE '2026-07-01'
         WHERE tenant_id = (SELECT id FROM platform.tenants WHERE slug='rabatexpress') AND ended_at IS NULL`);
    const alertMsg = nextAlert(page);
    await page.getByRole('button', { name: 'Lancer le cycle' }).click();
    const msg = await alertMsg;
    console.log(`cycle → ${msg.replace(/\n/g, ' | ')}`);
    // 3 reconductions : 07 → 08 → 09, une par période, sans saut.
    expect(msg).toContain('3 reconduction(s)');
    await page.reload();
  } else {
    console.log('rattrapage déjà joué — vérification de l’état final.');
  }

  // Période courante = mois en cours, échéance repassée dans le futur.
  expect(sql(SUB)).toBe('ACTIF|2026-09|2026-10-01');
  const row = page.getByRole('row', { name: /rabatexpress/ });
  await expect(row.getByText('Actif', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText('échéance 2026-10-01');
  await shotVp(page, 'TC-A25', '01-rabatexpress-rattrape-echeance-future');
});
