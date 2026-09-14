import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-N04 — Cloisonnement marchand.
// ATT : un marchand n'accède jamais à la console transport — ni par l'écran, ni par l'API.
test('TC-N04 — un marchand n’entre pas dans la console transport', async ({ page }) => {
  test.setTimeout(180_000);
  const email = 'marchand@rabatexpress.ma';
  const err = await loginTenant(page, 'rabatexpress', email, motDePasse(email));
  expect(err).toBeNull();
  await page.waitForURL('**/portail**', { timeout: 20_000 });

  for (const chemin of ['/dashboard', '/orders', '/cash']) {
    await page.goto(chemin);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    const url = new URL(page.url()).pathname;
    const corps = await page.locator('body').innerText();
    const refuse = url.startsWith('/portail') || url.startsWith('/login') || /refus|interdit|accès/i.test(corps);
    console.log(`  ${chemin} en marchand → ${url}${refuse ? '' : ' ⚠ SERVI'}`);
    expect(refuse, `${chemin} ne doit pas être servi à un marchand`).toBe(true);
  }
  await shotVp(page, 'TC-N04', '01-console-fermee-au-marchand');

  // L'API d'exploitation refuse aussi — l'écran n'est pas le seul rempart.
  const codes = await page.evaluate(async () => {
    const out: Record<string, number> = {};
    for (const c of ['/v1/orders', '/v1/drivers', '/v1/cash/sessions', '/v1/users']) {
      out[c] = (await fetch(`/api/proxy${c}`)).status;
    }
    return out;
  });
  console.log(`  API en marchand → ${JSON.stringify(codes)}`);
  for (const [chemin, code] of Object.entries(codes)) expect(code, chemin).toBe(403);
});
