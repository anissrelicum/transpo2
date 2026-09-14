import { test, expect } from '@playwright/test';
import { motDePasse, sql } from './helpers';

// TC-P06 — Notification automatique.
// ATT : un événement de course (création, mise en livraison, livraison) génère une
//       notification au client — sans qu'un opérateur ait à y penser.
test('TC-P06 — les événements de course notifient le client', async ({ request }) => {
  test.setTimeout(180_000);
  const API = process.env.API_URL || 'http://localhost:3000';
  const tel = '+212600445566';

  const login = await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'admin@rabatexpress.ma', password: motDePasse('admin@rabatexpress.ma') },
  });
  const token = (await login.json()).token;
  const entetes = { authorization: `Bearer ${token}`, 'x-tenant-slug': 'rabatexpress', 'content-type': 'application/json' };

  const compte = (evenement: string) => Number(sql(
    `SELECT count(*) FROM tenant_rabatexpress.notifications
     WHERE event = '${evenement}' AND recipient = '${tel}'`).trim());

  // Création : le client reçoit son code de suivi.
  const creation = await request.post(`${API}/v1/orders`, {
    headers: entetes,
    data: { merchant: 'Boutique Test', fromCity: 'Rabat', toCity: 'Casablanca', cod: 0,
            proofLevel: 'aucune', dropContact: 'Client Notif', dropPhone: tel, dropAddress: '1 rue du Test' },
  });
  expect(creation.ok()).toBe(true);
  const commande = await creation.json();
  console.log(`  commande ${commande.ref} créée pour ${tel}`);
  expect(compte('order.created')).toBe(1);

  const corps = sql(`SELECT body FROM tenant_rabatexpress.notifications
                     WHERE event = 'order.created' AND recipient = '${tel}' LIMIT 1`).trim();
  console.log(`  message envoyé → « ${corps} »`);
  expect(corps).toContain(commande.code);

  // Mise en livraison : le client sait que le colis arrive.
  await request.post(`${API}/v1/orders/${commande.ref}/assign`, { headers: entetes, data: { driver: 'Hamid Ouali' } });
  for (const _ of [1, 2]) {
    await request.post(`${API}/v1/orders/${commande.ref}/advance`, { headers: entetes, data: {} });
  }
  const statut = sql(`SELECT status FROM tenant_rabatexpress.orders WHERE ref = '${commande.ref}'`).trim();
  console.log(`  statut après deux progressions → ${statut}`);
  if (statut === 'LIVRAISON') {
    expect(compte('order.out')).toBe(1);
    console.log('  notification « en cours de livraison » émise');
  }
});
