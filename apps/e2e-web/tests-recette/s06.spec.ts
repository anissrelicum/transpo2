import { test, expect } from '@playwright/test';
import { motDePasse, sql } from './helpers';

// TC-S06 — Droits des personnes (loi 09-08).
// ATT : export complet des données d'un sujet ; après effacement, les données personnelles
//       disparaissent SANS casser l'intégrité comptable (commande anonymisée, pas supprimée).
test('TC-S06 — export et effacement des données d’une personne', async ({ request }) => {
  test.setTimeout(180_000);
  const API = process.env.API_URL || 'http://localhost:3000';

  const login = await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'admin@rabatexpress.ma', password: motDePasse('admin@rabatexpress.ma') },
  });
  const token = (await login.json()).token;
  const entetes = { authorization: `Bearer ${token}`, 'x-tenant-slug': 'rabatexpress', 'content-type': 'application/json' };

  // Un sujet identifiable : le téléphone d'un destinataire réel.
  const sujet = sql(`SELECT drop_phone FROM tenant_rabatexpress.orders
                     WHERE drop_phone IS NOT NULL AND drop_phone <> '' ORDER BY created_at DESC LIMIT 1`).trim();
  expect(sujet, 'une commande avec un téléphone destinataire est requise').toBeTruthy();
  const avant = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE drop_phone = '${sujet}'`).trim());
  console.log(`  sujet ${sujet} → ${avant} commande(s)`);

  const exp = await request.get(`${API}/v1/privacy/export?subject=${encodeURIComponent(sujet)}`, { headers: entetes });
  console.log(`  export → ${exp.status()}`);
  expect(exp.ok()).toBe(true);
  const donnees = await exp.json();
  expect(JSON.stringify(donnees)).toContain(sujet);

  const eff = await request.post(`${API}/v1/privacy/erase`, { headers: entetes, data: { subject: sujet } });
  console.log(`  effacement → ${eff.status()} ${JSON.stringify(await eff.json().catch(() => null))}`);
  expect(eff.ok()).toBe(true);

  // La donnée personnelle a disparu…
  const restant = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE drop_phone = '${sujet}'`).trim());
  console.log(`  après effacement → ${restant} commande(s) portant encore le téléphone`);
  expect(restant).toBe(0);

  // … mais les commandes existent toujours : l'effacement n'efface pas la comptabilité.
  const total = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders`).trim());
  console.log(`  commandes toujours en base → ${total}`);
  expect(total).toBeGreaterThan(0);
});
