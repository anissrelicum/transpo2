import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql, inviteUser, logout, saveCredential } from './helpers';

// TC-H05 — Accès au hub.
// ATT : le tri en hub est réservé à l'exploitation (ADMIN/DISPATCHER) ; un comptable n'y
//       écrit pas — et l'API le refuse, pas seulement l'écran.
test('TC-H05 — le hub est fermé à la comptabilité', async ({ page }) => {
  test.setTimeout(180_000);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Un compte comptable dédié, créé depuis la console (et non en base).
  const email = 'compta.hub@rabatexpress.ma';
  const existe = sql(`SELECT count(*) FROM tenant_rabatexpress.users WHERE email = '${email}'`).trim();
  if (existe === '0') {
    await page.goto('/users');
    const mdp = await inviteUser(page, 'Comptable Hub', email, 'Comptable');
    saveCredential(`- ${new Date().toISOString()} — ${email} — COMPTABLE — tempPassword=${mdp}`);
  }
  // On quitte la session administrateur en effaçant les cookies : le menu avatar n'est pas
  // toujours monté après une invitation, et ce cas ne teste pas la déconnexion.
  await page.context().clearCookies();

  const err2 = await loginTenant(page, 'rabatexpress', email, motDePasse(email));
  expect(err2).toBeNull();

  await page.goto('/hub');
  await page.waitForLoadState('domcontentloaded');
  const corps = await page.locator('body').innerText();
  await shotVp(page, 'TC-H05', '01-hub-vu-par-la-comptabilite');
  console.log(`  /hub vu par un comptable → ${corps.slice(0, 120).replace(/\n/g, ' ')}`);

  // Aucun geste d'exploitation ne doit être proposé.
  await expect(page.getByPlaceholder(/Scanner ou saisir un code colis/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Marquer scanné' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Placer sur quai' })).toHaveCount(0);

  // Et l'API refuse, même en contournant l'écran : c'est elle qui garde la porte.
  const refus = await page.evaluate(async () => {
    const r = await fetch('/api/proxy/v1/hub/scan', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'ABCD1234' }),
    });
    return r.status;
  });
  console.log(`  POST /v1/hub/scan en comptable → ${refus}`);
  expect(refus).toBe(403);
});
