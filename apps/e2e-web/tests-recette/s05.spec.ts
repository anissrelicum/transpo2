import { test, expect } from '@playwright/test';
import { loginSaas, shotVp, sql } from './helpers';

// TC-S05 — Journal d'audit.
// ATT : les actions sensibles sont tracées avec acteur, cible et horodatage.
test('TC-S05 — les actions sensibles laissent une trace', async ({ page }) => {
  test.setTimeout(180_000);

  const actions = sql(`SELECT DISTINCT action FROM platform.audit_log ORDER BY action`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`  actions tracées → ${actions.join(', ')}`);

  // Les familles d'actions qui doivent être opposables.
  const attendues = ['tenant.provision', 'user.invite'];
  for (const a of attendues) {
    expect(actions.some((x) => x.startsWith(a.split('.')[0])), `aucune trace de ${a}`).toBe(true);
  }

  // Chaque entrée porte un acteur et un horodatage — sans quoi elle ne prouve rien.
  const incompletes = sql(`SELECT count(*) FROM platform.audit_log
                           WHERE actor IS NULL OR actor = '' OR at IS NULL`).trim();
  console.log(`  entrées sans acteur ou sans date → ${incompletes}`);
  expect(incompletes).toBe('0');

  await loginSaas(page);
  await page.goto('/saas/audit');
  await page.waitForTimeout(2000);
  const corps = await page.locator('body').innerText();
  await shotVp(page, 'TC-S05', '01-journal-audit');
  const derniere = sql(`SELECT action, actor FROM platform.audit_log ORDER BY at DESC LIMIT 1`)
    .split('|').map((x) => x.trim());
  console.log(`  dernière entrée → ${derniere.join(' par ')}`);
  expect(corps).toContain(derniere[0].split('.')[0]);
});
