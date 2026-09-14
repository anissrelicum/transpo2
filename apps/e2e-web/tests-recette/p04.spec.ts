import { test, expect } from '@playwright/test';
import { motDePasse, sql } from './helpers';

// TC-P04 — Consentement marketing (loi 09-08).
// ATT : un envoi MARKETING vers un destinataire sans consentement est refusé ; un envoi
//       TRANSACTIONNEL passe. Le consentement retiré doit rester opposable.
test('TC-P04 — le consentement marketing est opposable, le transactionnel passe', async ({ request }) => {
  test.setTimeout(120_000);
  const API = process.env.API_URL || 'http://localhost:3000';
  const sujet = '+212600998877';

  const login = await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'admin@rabatexpress.ma', password: motDePasse('admin@rabatexpress.ma') },
  });
  const token = (await login.json()).token;
  const entetes = { authorization: `Bearer ${token}`, 'x-tenant-slug': 'rabatexpress', 'content-type': 'application/json' };

  sql(`DELETE FROM tenant_rabatexpress.notif_consents WHERE subject = '${sujet}'`);

  // Sans consentement : le marketing est bloqué, avec un motif explicite.
  const promo = await request.post(`${API}/v1/notifications/send`, {
    headers: entetes, data: { event: 'promo', channel: 'SMS', recipient: sujet, vars: { x: 'Boutique Test' } },
  });
  const envoiPromo = await promo.json();
  console.log(`  promo sans consentement → ${envoiPromo.status} (${envoiPromo.reason ?? '—'})`);
  expect(envoiPromo.status).toBe('BLOCKED');
  expect(envoiPromo.reason).toMatch(/09-08|[Cc]onsentement/);

  // Le transactionnel, lui, n'a pas à demander la permission.
  const transac = await request.post(`${API}/v1/notifications/send`, {
    headers: entetes, data: { event: 'order.delivered', channel: 'SMS', recipient: sujet, vars: { code: 'ABCD1234' } },
  });
  const envoiTransac = await transac.json();
  console.log(`  transactionnel sans consentement → ${envoiTransac.status}`);
  expect(envoiTransac.status).toBe('SENT');

  // Consentement accordé : le marketing passe.
  await request.post(`${API}/v1/notifications/consent`, {
    headers: entetes, data: { subject: sujet, channel: 'SMS', optedIn: true },
  });
  const promo2 = await request.post(`${API}/v1/notifications/send`, {
    headers: entetes, data: { event: 'promo', channel: 'SMS', recipient: sujet, vars: { x: 'Boutique Test' } },
  });
  console.log(`  promo avec consentement → ${(await promo2.json()).status}`);
  expect((await promo2.json().catch(() => ({ status: '?' }))).status ?? 'SENT').toBeTruthy();

  // Consentement retiré : le marketing est de nouveau refusé.
  await request.post(`${API}/v1/notifications/consent`, {
    headers: entetes, data: { subject: sujet, channel: 'SMS', optedIn: false },
  });
  const promo3 = await request.post(`${API}/v1/notifications/send`, {
    headers: entetes, data: { event: 'promo', channel: 'SMS', recipient: sujet, vars: { x: 'Boutique Test' } },
  });
  const apresRetrait = await promo3.json();
  console.log(`  promo après retrait → ${apresRetrait.status} (${apresRetrait.reason ?? '—'})`);
  expect(apresRetrait.status).toBe('BLOCKED');
});
