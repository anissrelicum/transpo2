import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql, inviteUser, logout, saveCredential } from './helpers';

// TC-L07 — Accès finance.
// ATT : un dispatcher peut éventuellement lire, mais n'écrit RIEN sur la caisse ni les
//       reversements — l'argent n'est pas du ressort du dispatch.
test('TC-L07 — le dispatch n’écrit pas sur l’argent', async ({ page }) => {
  test.setTimeout(180_000);
  const email = 'dispatch.finance@rabatexpress.ma';
  const existe = sql(`SELECT count(*) FROM tenant_rabatexpress.users WHERE email = '${email}'`).trim();
  if (existe === '0') {
    const admin = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
    expect(admin).toBeNull();
    await page.goto('/users');
    const mdp = await inviteUser(page, 'Dispatch Finance', email, 'Dispatcher');
    saveCredential(`- ${new Date().toISOString()} — ${email} — DISPATCHER — tempPassword=${mdp}`);
    await logout(page);
  }

  const err = await loginTenant(page, 'rabatexpress', email, motDePasse(email));
  expect(err).toBeNull();

  const session = sql(`SELECT id FROM tenant_rabatexpress.cash_sessions LIMIT 1`).trim();
  const reversement = sql(`SELECT id FROM tenant_rabatexpress.payouts LIMIT 1`).trim();

  const codes = await page.evaluate(async ([sid, pid]) => {
    const out: Record<string, number> = {};
    out['GET /cash/sessions'] = (await fetch('/api/proxy/v1/cash/sessions')).status;
    out['POST /cash/deposit'] = (await fetch(`/api/proxy/v1/cash/sessions/${sid}/deposit`, { method: 'POST' })).status;
    out['POST /cash/resolve'] = (await fetch(`/api/proxy/v1/cash/sessions/${sid}/resolve`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Test' }),
    })).status;
    out['POST /reversements/generate'] = (await fetch('/api/proxy/v1/cash/reversements/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ period: '2026-09' }),
    })).status;
    if (pid) out['POST /reversements/pay'] = (await fetch(`/api/proxy/v1/cash/reversements/${pid}/pay`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'virement' }),
    })).status;
    return out;
  }, [session, reversement] as const);

  console.log(`  accès finance en dispatcher → ${JSON.stringify(codes, null, 0)}`);
  await shotVp(page, 'TC-L07', '01-acces-finance');
  for (const [action, code] of Object.entries(codes)) {
    if (action.startsWith('POST')) expect(code, action).toBe(403);
  }

  // Et rien n'a bougé côté données.
  if (session) {
    const statut = sql(`SELECT status FROM tenant_rabatexpress.cash_sessions WHERE id = '${session}'`).trim();
    console.log(`  session inchangée → ${statut}`);
  }
});
