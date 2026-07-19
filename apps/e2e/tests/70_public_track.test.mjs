import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, waitForApi } from '../helpers.mjs';

// Suivi public : aucune authentification, tenant dans l'URL.
const SLUG = 'e2e';
const CODE = 'TRACK123'; // commande LIVREE seedée

before(async () => { await waitForApi(); });

test('suivi public : timeline par code, sans compte', async () => {
  const r = await api(`/v1/public/track/${SLUG}/${CODE}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'LIVREE');
  assert.equal(r.json.delivered, true);
  assert.ok(Array.isArray(r.json.steps) && r.json.steps.every((s) => s.done)); // toutes les étapes franchies
  assert.equal(r.json.to, 'Rabat');
});

test('suivi public : code inconnu → 404', async () => {
  const r = await api(`/v1/public/track/${SLUG}/NOPE9999`);
  assert.equal(r.status, 404);
});

test('suivi public : tenant inconnu → 404', async () => {
  const r = await api(`/v1/public/track/pas-un-tenant/${CODE}`);
  assert.equal(r.status, 404);
});

test('notation : note hors bornes → 400', async () => {
  const r = await api(`/v1/public/track/${SLUG}/${CODE}/rate`, { method: 'POST', body: { score: 9 } });
  assert.equal(r.status, 400);
});

test('notation : note valide enregistrée puis verrouillée', async () => {
  const r = await api(`/v1/public/track/${SLUG}/${CODE}/rate`, { method: 'POST', body: { score: 5, comment: 'Parfait' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.rating, 5);
  // Re-notation refusée
  const again = await api(`/v1/public/track/${SLUG}/${CODE}/rate`, { method: 'POST', body: { score: 3 } });
  assert.equal(again.status, 400);
});
