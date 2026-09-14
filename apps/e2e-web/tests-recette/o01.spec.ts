import { test, expect } from '@playwright/test';
import { sql } from './helpers';

// TC-O01 / TC-O02 — Suivi client public par code.
// ATT : statut et étapes affichés, AUCUNE donnée sensible (adresse, téléphone, identité du
//       livreur) ; un code inconnu est refusé sans rien révéler.
test('TC-O01 — suivi public d’une commande, sans fuite de données', async ({ request }) => {
  test.setTimeout(120_000);
  const API = process.env.API_URL || 'http://localhost:3000';

  const ligne = sql(`SELECT code, status, drop_phone, drop_address, driver FROM tenant_rabatexpress.orders
                     WHERE status NOT IN ('ANNULEE') ORDER BY created_at DESC LIMIT 1`)
    .split('|').map((x) => x.trim());
  const [code, statut, tel, adresse, livreur] = ligne;
  expect(code).toBeTruthy();

  const r = await request.get(`${API}/v1/public/track/rabatexpress/${code}`);
  expect(r.ok()).toBe(true);
  const suivi = await r.json();
  const brut = JSON.stringify(suivi);
  console.log(`  suivi de ${code} → ${suivi.statusLabel}, ${suivi.steps.length} étape(s)`);
  expect(suivi.status).toBe(statut);
  expect(suivi.steps.length).toBeGreaterThan(3);
  expect(suivi.from).toBeTruthy();

  // Rien de ce qui identifie le destinataire ou le livreur ne doit sortir.
  if (tel && tel !== '') expect(brut).not.toContain(tel);
  if (adresse && adresse !== '') expect(brut).not.toContain(adresse);
  if (livreur && livreur !== '') expect(brut).not.toContain(livreur);
  console.log('  aucune donnée sensible dans la réponse publique (téléphone, adresse, livreur)');

  // Code inconnu : refus net, sans indice sur l'existence du tenant ou des commandes.
  const inconnu = await request.get(`${API}/v1/public/track/rabatexpress/ZZ99ZZ99`);
  console.log(`  code inconnu → ${inconnu.status()} ${(await inconnu.text()).slice(0, 60)}`);
  expect(inconnu.status()).toBe(404);
});

// TC-O03 — Notation post-livraison.
// ATT : une commande livrée peut être notée une seule fois ; une commande non livrée ne
//       peut pas l'être du tout.
test('TC-O03 — notation d’une livraison, une seule fois', async ({ request }) => {
  test.setTimeout(120_000);
  const API = process.env.API_URL || 'http://localhost:3000';

  const code = sql(`SELECT code FROM tenant_rabatexpress.orders
                    WHERE status = 'LIVREE' ORDER BY created_at DESC LIMIT 1`).trim();
  expect(code, 'une commande livrée doit exister').toBeTruthy();
  sql(`UPDATE tenant_rabatexpress.orders SET rating = NULL, rating_comment = NULL WHERE code = '${code}'`);

  const note = await request.post(`${API}/v1/public/track/rabatexpress/${code}/rate`, {
    headers: { 'content-type': 'application/json' },
    data: { score: 4, comment: 'Livraison rapide et soignee.' },
  });
  console.log(`  notation → ${note.status()} ${(await note.text()).slice(0, 80)}`);
  expect(note.ok()).toBe(true);
  expect(sql(`SELECT rating FROM tenant_rabatexpress.orders WHERE code = '${code}'`).trim()).toBe('4');

  // Une seconde note sur le même code est refusée : un avis, un client, une fois.
  const seconde = await request.post(`${API}/v1/public/track/rabatexpress/${code}/rate`, {
    headers: { 'content-type': 'application/json' }, data: { score: 1 },
  });
  console.log(`  seconde notation → ${seconde.status()}`);
  expect(seconde.status()).toBe(400);
  expect(sql(`SELECT rating FROM tenant_rabatexpress.orders WHERE code = '${code}'`).trim()).toBe('4');

  // Et une commande non livrée ne se note pas.
  const enCours = sql(`SELECT code FROM tenant_rabatexpress.orders
                       WHERE status NOT IN ('LIVREE','ANNULEE') ORDER BY created_at DESC LIMIT 1`).trim();
  if (enCours) {
    const r = await request.post(`${API}/v1/public/track/rabatexpress/${enCours}/rate`, {
      headers: { 'content-type': 'application/json' }, data: { score: 5 },
    });
    console.log(`  notation d’une commande non livrée → ${r.status()}`);
    expect(r.status()).toBe(400);
  }
});
