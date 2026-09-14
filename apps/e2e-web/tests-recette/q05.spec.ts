import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-Q05 — La fraude est réservée à l'administrateur.
// ATT : un dispatcher n'y accède pas, ni par l'écran ni par l'API.
test('TC-Q05 — le dossier de fraude est fermé au dispatch', async ({ page }) => {
  test.setTimeout(180_000);
  const email = 'dispatch.fraude@rabatexpress.ma';
  const existe = sql(`SELECT count(*) FROM tenant_rabatexpress.users WHERE email = '${email}'`).trim();
  if (existe === '0') {
    const admin = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
    expect(admin).toBeNull();
    await page.goto('/users');
    const { inviteUser, logout, saveCredential } = await import('./helpers');
    const mdp = await inviteUser(page, 'Dispatch Fraude', email, 'Dispatcher');
    saveCredential(`- ${new Date().toISOString()} — ${email} — DISPATCHER — tempPassword=${mdp}`);
    await logout(page);
  }

  const err = await loginTenant(page, 'rabatexpress', email, motDePasse(email));
  expect(err).toBeNull();
  await page.goto('/fraud');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  const corps = await page.locator('body').innerText();
  console.log(`  /fraud en dispatcher → ${corps.slice(0, 100).replace(/\n/g, ' ')}`);
  await shotVp(page, 'TC-Q05', '01-acces-refuse');
  expect(/refus|interdit|accès|autoris/i.test(corps) || new URL(page.url()).pathname !== '/fraud').toBe(true);

  const codes = await page.evaluate(async () => ({
    cases: (await fetch('/api/proxy/v1/fraud/cases')).status,
    leaderboard: (await fetch('/api/proxy/v1/fraud/leaderboard')).status,
  }));
  console.log(`  API fraude en dispatcher → ${JSON.stringify(codes)}`);
  expect(codes.cases).toBe(403);
  expect(codes.leaderboard).toBe(403);
});
