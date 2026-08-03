import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

const DRIVER = 'Youssef Benali';
let admin, driver, ref;
const idem = (k) => ({ headers: { 'idempotency-key': k } });

// Artefacts minimaux valides : 1 px GIF-like en JPEG et un PNG transparent.
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const SIGN = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  driver = await login('e2e', 'livreur@e2e.ma');
  const o = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat', cod: 400 } })).json;
  ref = o.ref;
  await api(`/v1/orders/${ref}/assign`, { method: 'POST', token: admin, body: { driver: DRIVER } });
});

test('livreur : ses missions listent la commande assignée', async () => {
  const r = await api('/v1/driver/missions', { token: driver });
  assert.equal(r.status, 200);
  assert.ok(r.json.some((o) => o.ref === ref && o.status === 'ASSIGNEE'));
});

test('livreur : avancement idempotent (rejeu même clé = pas de double effet)', async () => {
  const r1 = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver, ...idem('ADV1') });
  assert.equal(r1.json.status, 'RETRAIT');
  const replay = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver, ...idem('ADV1') });
  assert.equal(replay.json.status, 'RETRAIT'); // rejeu : toujours RETRAIT, pas RECUPEREE
  const r2 = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver, ...idem('ADV2') });
  assert.equal(r2.json.status, 'RECUPEREE');
  const r3 = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver, ...idem('ADV3') });
  assert.equal(r3.json.status, 'LIVRAISON');
  const r4 = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver });
  assert.equal(r4.status, 400); // livraison via preuve
});

test('livreur : preuve refusée sans les artefacts exigés par le proofLevel', async () => {
  // La commande est créée au niveau par défaut `photo_signature`.
  const r = await api(`/v1/driver/orders/${ref}/proof`, { method: 'POST', token: driver, body: { codCollected: 400 } });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /Preuve incomplète/);
});

test('livreur : preuve refusée si un seul des deux artefacts est fourni', async () => {
  const r = await api(`/v1/driver/orders/${ref}/proof`, {
    method: 'POST', token: driver, body: { codCollected: 400, photo: PHOTO },
  });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /signature/);
});

test('livreur : artefact rejeté si ce n’est pas un data URI attendu', async () => {
  const r = await api(`/v1/driver/orders/${ref}/proof`, {
    method: 'POST', token: driver, body: { codCollected: 400, photo: 'https://exemple.ma/photo.jpg', signature: SIGN },
  });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /data URI/);
});

test('livreur : preuve complète + encaissement COD → LIVREE, idempotent', async () => {
  const body = { codCollected: 400, photo: PHOTO, signature: SIGN };
  const p1 = await api(`/v1/driver/orders/${ref}/proof`, { method: 'POST', token: driver, body, ...idem('PRF1') });
  assert.equal(p1.json.status, 'LIVREE');
  assert.equal(p1.json.codPaid, true);
  const p2 = await api(`/v1/driver/orders/${ref}/proof`, { method: 'POST', token: driver, body, ...idem('PRF1') });
  assert.deepEqual(p2.json, p1.json); // rejeu : réponse mémorisée identique
});

test('ops : la preuve capturée est consultable depuis la console', async () => {
  const r = await api(`/v1/orders/${ref}/proof`, { token: admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.captured, true);
  assert.equal(r.json.proofLevel, 'photo_signature');
  assert.equal(r.json.photo, PHOTO);
  assert.equal(r.json.capturedBy, DRIVER);
});

test('RBAC : un admin n’accède pas à l’app livreur', async () => {
  const r = await api('/v1/driver/missions', { token: admin });
  assert.equal(r.status, 403);
});

test('sécurité : un livreur ne peut pas agir sur la commande d’un autre', async () => {
  const other = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Fès', cod: 100 } })).json;
  await api(`/v1/orders/${other.ref}/assign`, { method: 'POST', token: admin, body: { driver: 'Salma Idrissi' } });
  const r = await api(`/v1/driver/orders/${other.ref}/advance`, { method: 'POST', token: driver });
  assert.equal(r.status, 403);
});
