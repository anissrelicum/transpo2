import { test, expect } from '@playwright/test';
import { motDePasse, sql } from './helpers';

// TC-P03 — Réessai d'une notification bloquée.
// ATT : le rejeu produit une NOUVELLE tentative tracée, et réévalue les règles d'envoi —
//       une notification bloquée faute de consentement doit passer une fois le
//       consentement accordé, et rester bloquée sinon.
test('TC-P03 — rejouer une notification bloquée', async ({ request }) => {
  test.setTimeout(120_000);
  const API = process.env.API_URL || 'http://localhost:3000';
  const sujet = '+212600334455';

  const login = await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'admin@rabatexpress.ma', password: motDePasse('admin@rabatexpress.ma') },
  });
  const token = (await login.json()).token;
  const entetes = { authorization: `Bearer ${token}`, 'x-tenant-slug': 'rabatexpress', 'content-type': 'application/json' };

  sql(`DELETE FROM tenant_rabatexpress.notif_consents WHERE subject = '${sujet}'`);
  sql(`DELETE FROM tenant_rabatexpress.notifications WHERE recipient = '${sujet}'`);

  // Un envoi marketing sans consentement : bloqué, et tracé comme tel.
  const bloquee = await (await request.post(`${API}/v1/notifications/send`, {
    headers: entetes, data: { event: 'promo', channel: 'SMS', recipient: sujet, vars: { x: 'Boutique Test' } },
  })).json();
  console.log(`  envoi initial → ${bloquee.status} (${bloquee.reason ?? '—'})`);
  expect(bloquee.status).toBe('BLOCKED');

  // Rejeu sans rien changer : toujours bloqué, et une trace de plus.
  const avant = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.notifications WHERE recipient = '${sujet}'`).trim());
  const rejeu1 = await request.post(`${API}/v1/notifications/${bloquee.id}/retry`, { headers: entetes });
  console.log(`  rejeu sans consentement → ${rejeu1.status()} ${JSON.stringify(await rejeu1.json().catch(() => null)).slice(0, 90)}`);
  expect(rejeu1.ok()).toBe(true);
  const apres = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.notifications WHERE recipient = '${sujet}'`).trim());
  console.log(`  journal : ${avant} → ${apres} tentative(s)`);
  expect(apres).toBeGreaterThan(avant);

  // Consentement accordé : le rejeu doit désormais passer — les règles sont réévaluées,
  // le message n'est pas renvoyé aveuglément avec son ancien verdict.
  await request.post(`${API}/v1/notifications/consent`, {
    headers: entetes, data: { subject: sujet, channel: 'SMS', optedIn: true },
  });
  const rejeu2 = await (await request.post(`${API}/v1/notifications/${bloquee.id}/retry`, { headers: entetes })).json();
  console.log(`  rejeu après consentement → ${rejeu2.status}`);
  expect(rejeu2.status).toBe('SENT');
});
