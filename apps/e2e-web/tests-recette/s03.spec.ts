import { test, expect } from '@playwright/test';
import { motDePasse, sql } from './helpers';

// TC-S03 — Isolation du scope livreur.
// ATT : le compte livreur ne voit QUE les missions de son chauffeur, et rien des écrans
//       d'exploitation — le cloisonnement ne tient pas au seul affichage mobile.
test('TC-S03 — le compte livreur est borné à son chauffeur', async ({ request }) => {
  test.setTimeout(120_000);
  const API = process.env.API_URL || 'http://localhost:3000';

  const login = await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'livreur@rabatexpress.ma', password: motDePasse('livreur@rabatexpress.ma') },
  });
  expect(login.ok()).toBe(true);
  const { token, driver } = await login.json();
  console.log(`  jeton livreur → chauffeur ${driver}`);
  expect(driver).toBe('Hamid Ouali');

  const missions = await request.get(`${API}/v1/driver/missions`, {
    headers: { authorization: `Bearer ${token}`, 'x-tenant-slug': 'rabatexpress' },
  });
  const liste = await missions.json();
  const autres = sql(`SELECT ref FROM tenant_rabatexpress.orders
                      WHERE driver IS NOT NULL AND driver <> 'Hamid Ouali'`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`  ${liste.length} mission(s) rendues ; ${autres.length} commande(s) d’un autre chauffeur en base`);
  for (const o of liste) expect(o.driver).toBe('Hamid Ouali');
  for (const ref of autres) expect(liste.some((o: any) => o.ref === ref)).toBe(false);

  // Les écrans d'exploitation restent fermés à ce compte.
  for (const chemin of ['/v1/orders', '/v1/drivers', '/v1/cash/sessions', '/v1/users']) {
    const r = await request.get(`${API}${chemin}`, {
      headers: { authorization: `Bearer ${token}`, 'x-tenant-slug': 'rabatexpress' },
    });
    console.log(`  ${chemin} en livreur → ${r.status()}`);
    expect(r.status()).toBe(403);
  }
});
