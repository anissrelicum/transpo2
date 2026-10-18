// Affectation automatique équitable avec acceptation livreur (ADR 0004).
//
// Tenant DÉDIÉ, provisionné pour ce fichier : l'interrupteur d'entreprise y est basculé, ce
// qui ferait proposer les commandes des autres suites si elles partageaient le tenant.
//
// La passe périodique de l'API doit tourner (AUTO_DISPATCH_INTERVAL_MS, 15 s par défaut) :
// le cas « expiration » attend l'échéance réelle d'une proposition (1 min, délai minimal).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, superLogin, waitForApi } from '../helpers.mjs';

const SLUG = `autodisp${Date.now().toString(36)}`;
// Carrés en [lat, lng] : deux quartiers de Casablanca qui ne se recouvrent pas.
const box = (lat, lng, d = 0.012) => [[lat - d, lng - d], [lat - d, lng + d], [lat + d, lng + d], [lat + d, lng - d]];
const MAARIF = { lat: 33.5883, lng: -7.6324 };
const AGDAL = { lat: 33.5600, lng: -7.6600 };   // ~4 km du Maârif, hors de son carré
const ANFA = { lat: 33.6000, lng: -7.6700 };
const HORS = { lat: 33.7000, lng: -7.3000 };    // couvert par aucune zone

let admin;
const drivers = {};   // nom → { id, token }

async function as(token, path, opts = {}) {
  return api(path, { ...opts, token });
}
async function mkDriver(name, { available = true, account = true } = {}) {
  const d = await as(admin, '/v1/drivers', {
    method: 'POST',
    body: { name, city: 'Casablanca', vehicle: 'Moto', licenseDue: '2030-01-01', medicalDue: '2030-01-01', available },
  });
  assert.equal(d.status, 201, JSON.stringify(d.json));
  drivers[name] = { id: d.json.id, token: null };
  if (!account) return;
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@${SLUG}.ma`;
  const u = await as(admin, '/v1/users', { method: 'POST', body: { email, name, role: 'DRIVER', driver: name } });
  assert.equal(u.status, 201, JSON.stringify(u.json));
  const l = await api('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email, password: u.json.tempPassword } });
  assert.equal(l.status, 200, JSON.stringify(l.json));
  drivers[name].token = l.json.token;
}
async function mkZone(nameFr, center, names) {
  const z = await as(admin, '/v1/dispatch/zones', {
    method: 'POST', body: { nameFr, province: 'Casablanca', polygon: box(center.lat, center.lng), centerLat: center.lat, centerLng: center.lng },
  });
  assert.equal(z.status, 201, JSON.stringify(z.json));
  const p = await as(admin, `/v1/dispatch/zones/${z.json.id}`, { method: 'PATCH', body: { drivers: names } });
  assert.equal(p.status, 200, JSON.stringify(p.json));
}
async function mkOrder(at) {
  const r = await as(admin, '/v1/orders', {
    method: 'POST',
    body: { fromCity: 'Casablanca', toCity: 'Casablanca', cod: 100, pickupLat: at.lat, pickupLng: at.lng },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.ref;
}
const settings = (body) => as(admin, '/v1/dispatch/settings', { method: 'PUT', body });
const offersOf = async (ref) => (await as(admin, `/v1/dispatch/offers/${ref}`)).json;
const pendingOf = async (ref) => (await offersOf(ref)).filter((o) => o.status === 'PROPOSEE');
const order = async (ref) => (await as(admin, `/v1/orders/${ref}`)).json;
const events = async (ref) => (await as(admin, `/v1/orders/${ref}/events`)).json;
const myOffers = async (name) => (await as(drivers[name].token, '/v1/driver/offers')).json;
const respond = (name, id, decision, key = `${id}:${decision}`) =>
  as(drivers[name].token, `/v1/driver/offers/${id}/${decision}`, { method: 'POST', body: {}, headers: { 'idempotency-key': key } });
async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`délai dépassé : ${label}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

before(async () => {
  await waitForApi();
  const sa = await superLogin();
  const p = await api('/v1/saas/tenants', {
    method: 'POST', token: sa,
    body: { slug: SLUG, name: 'Auto Dispatch Test', city: 'Casablanca', adminEmail: `admin@${SLUG}.ma`, adminName: 'Admin Auto' },
  });
  assert.equal(p.status, 201, JSON.stringify(p.json));
  const l = await api('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email: `admin@${SLUG}.ma`, password: p.json.admin.tempPassword } });
  assert.equal(l.status, 200);
  admin = l.json.token;

  for (const n of ['Amine Test', 'Badr Test', 'Chama Test', 'Dounia Test']) await mkDriver(n);
  await mkDriver('Elias Indispo', { available: false });
  await mkDriver('Farid SansCompte', { account: false });
  await mkZone('Maârif', MAARIF, ['Amine Test', 'Badr Test', 'Chama Test', 'Farid SansCompte']);
  await mkZone('Agdal', AGDAL, ['Dounia Test']);
  await mkZone('Anfa', ANFA, ['Elias Indispo', 'Farid SansCompte']);
});

test('réglages : désactivé par défaut, délai 3 min, capacité 20', async () => {
  const r = await as(admin, '/v1/dispatch/settings');
  assert.equal(r.status, 200);
  assert.equal(r.json.autoDispatch, false);
  assert.equal(r.json.offerTimeoutMin, 3);
  assert.equal(r.json.defaultDailyCapacity, 20);
});

test('RBAC : un livreur ne règle pas l’automate et ne voit pas les exceptions', async () => {
  const t = drivers['Amine Test'].token;
  assert.equal((await as(t, '/v1/dispatch/settings', { method: 'PUT', body: { autoDispatch: true } })).status, 403);
  assert.equal((await as(t, '/v1/dispatch/exceptions')).status, 403);
  assert.equal((await as(t, '/v1/dispatch/auto/run', { method: 'POST', body: {} })).status, 403);
});

test('réglages : bornes validées (délai 1..60, capacité 1..500)', async () => {
  assert.equal((await settings({ offerTimeoutMin: 0 })).status, 400);
  assert.equal((await settings({ defaultDailyCapacity: 501 })).status, 400);
  assert.equal((await settings({ autoDispatch: 'oui' })).status, 400);
});

test('automate coupé : une commande nouvelle reste à la main du dispatcher (aucune proposition)', async () => {
  const ref = await mkOrder(MAARIF);
  await as(admin, '/v1/dispatch/auto/run', { method: 'POST', body: {} });
  assert.deepEqual(await offersOf(ref), []);
  const o = await order(ref);
  assert.equal(o.status, 'NOUVELLE');
  assert.equal(o.driver, null);
  assert.equal(o.dispatchException, null);
  // Nettoyage : la commande ne doit pas être rattrapée quand l'automate sera allumé.
  assert.equal((await as(admin, `/v1/orders/${ref}/cancel`, { method: 'POST', body: {} })).status, 200);
});

test('capacité par livreur : bornes validées, null = défaut d’entreprise', async () => {
  const id = drivers['Dounia Test'].id;
  assert.equal((await as(admin, `/v1/drivers/${id}`, { method: 'PATCH', body: { dailyCapacity: 0 } })).status, 400);
  const ok = await as(admin, `/v1/drivers/${id}`, { method: 'PATCH', body: { dailyCapacity: 1 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.dailyCapacity, 1);
  const list = (await as(admin, '/v1/drivers')).json;
  assert.equal(list.find((d) => d.name === 'Farid SansCompte').appAccount, 'AUCUN');
  assert.equal(list.find((d) => d.name === 'Amine Test').appAccount, 'ACTIF');
});

test('automate actif : la commande est proposée au livreur éligible le MOINS chargé', async () => {
  // Charge du jour, posée à la main AVANT d'allumer : Amine 2, Badr 1, Chama 0.
  for (const [n, k] of [['Amine Test', 2], ['Badr Test', 1]]) {
    for (let i = 0; i < k; i++) {
      const ref = await mkOrder(MAARIF);
      assert.equal((await as(admin, `/v1/orders/${ref}/assign`, { method: 'POST', body: { driver: n } })).status, 200);
    }
  }
  const s = await settings({ autoDispatch: true, offerTimeoutMin: 1, defaultDailyCapacity: 5 });
  assert.equal(s.status, 200, JSON.stringify(s.json));

  const ref = await mkOrder(MAARIF);
  const pending = await pendingOf(ref);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].driver, 'Chama Test');
  // Farid couvre la zone mais n'a pas de compte d'app : il ne reçoit rien.
  assert.ok(!(await offersOf(ref)).some((o) => o.driver === 'Farid SansCompte'));
  // La commande reste NOUVELLE tant que personne n'a accepté.
  assert.equal((await order(ref)).status, 'NOUVELLE');
  // Seul le livreur sollicité voit la proposition, sans le téléphone du destinataire.
  const mine = await myOffers('Chama Test');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].ref, ref);
  assert.equal(mine[0].order.dropPhone, undefined);
  assert.deepEqual(await myOffers('Amine Test'), []);
  const ev = await events(ref);
  assert.ok(ev.some((e) => e.status === 'OFFRE_PROPOSEE' && /Chama Test/.test(e.note) && /charge 0\/5/.test(e.note)));
});

test('refus → proposition au suivant ; acceptation → ASSIGNEE, idempotente', async () => {
  const ref = (await myOffers('Chama Test'))[0].ref;
  const offre = (await myOffers('Chama Test'))[0];
  // Un autre livreur ne peut pas répondre à la place du destinataire.
  assert.equal((await respond('Amine Test', offre.id, 'accept')).status, 403);
  const r = await respond('Chama Test', offre.id, 'refuse');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'REFUSEE');
  // Rejouer le refus (file hors ligne) : même réponse, aucun effet de plus.
  assert.equal((await respond('Chama Test', offre.id, 'refuse')).json.status, 'REFUSEE');

  // Badr (1/5) passe avant Amine (2/5).
  const next = await pendingOf(ref);
  assert.equal(next.length, 1);
  assert.equal(next[0].driver, 'Badr Test');
  const acc = await respond('Badr Test', next[0].id, 'accept');
  assert.equal(acc.status, 200, JSON.stringify(acc.json));
  assert.equal(acc.json.status, 'ACCEPTEE');
  const replay = await respond('Badr Test', next[0].id, 'accept');
  assert.equal(replay.status, 200);
  assert.equal(replay.json.status, 'ACCEPTEE');

  const o = await order(ref);
  assert.equal(o.status, 'ASSIGNEE');
  assert.equal(o.driver, 'Badr Test');
  assert.ok(o.assignedAt);
  const ev = await events(ref);
  assert.ok(ev.some((e) => e.status === 'OFFRE_REFUSEE' && e.actor === 'Chama Test'));
  assert.equal(ev.filter((e) => e.status === 'ASSIGNEE').length, 1, 'une seule affectation malgré le rejeu');
  // La mission apparaît chez Badr.
  const missions = (await as(drivers['Badr Test'].token, '/v1/driver/missions')).json;
  assert.ok(missions.some((m) => m.ref === ref));
});

test('affectation manuelle pendant une proposition : la proposition est retirée', async () => {
  const ref = await mkOrder(MAARIF);
  const [p] = await pendingOf(ref);
  assert.ok(p, 'proposition créée');
  const a = await as(admin, `/v1/orders/${ref}/assign`, { method: 'POST', body: { driver: 'Amine Test' } });
  assert.equal(a.status, 200);
  assert.equal((await pendingOf(ref)).length, 0);
  assert.ok((await offersOf(ref)).some((o) => o.id === p.id && o.status === 'ANNULEE'));
  const late = await respond(p.driver, p.id, 'accept');
  assert.equal(late.status, 409);
  assert.equal((await order(ref)).driver, 'Amine Test');
});

test('expiration (délai réel d’une minute) → proposition au suivant', { timeout: 120000 }, async () => {
  // Charges : Amine 3, Badr 2, Chama 0 → Chama.
  const ref = await mkOrder(MAARIF);
  const [first] = await pendingOf(ref);
  assert.equal(first.driver, 'Chama Test');
  // La passe périodique expire la proposition et passe au suivant (Badr 2/5 < Amine 3/5).
  const second = await waitFor(async () => {
    const p = await pendingOf(ref);
    return p.length && p[0].id !== first.id ? p[0] : null;
  }, 100000, 'expiration de la proposition');
  assert.equal(second.driver, 'Badr Test');
  assert.ok((await offersOf(ref)).some((o) => o.id === first.id && o.status === 'EXPIREE'));
  assert.ok((await events(ref)).some((e) => e.status === 'OFFRE_EXPIREE'));
  // Accepter après échéance : refusé, le serveur fait foi.
  assert.equal((await respond('Chama Test', first.id, 'accept')).status, 409);

  // Tous refusent → REFUSEE_PAR_TOUS (Chama a laissé expirer, Badr et Amine refusent).
  assert.equal((await respond('Badr Test', second.id, 'refuse')).status, 200);
  const [third] = await pendingOf(ref);
  assert.equal(third.driver, 'Amine Test');
  assert.equal((await respond('Amine Test', third.id, 'refuse')).status, 200);
  assert.equal((await pendingOf(ref)).length, 0);
  const o = await order(ref);
  assert.equal(o.dispatchException, 'REFUSEE_PAR_TOUS');
  assert.equal(o.status, 'NOUVELLE');
  const exc = (await as(admin, '/v1/dispatch/exceptions')).json;
  const row = exc.find((x) => x.ref === ref);
  assert.equal(row.reason, 'REFUSEE_PAR_TOUS');
  assert.equal(row.declined, 3);
  // Alerte interne à l'exploitation (cloche de la console).
  const notifs = (await as(admin, '/v1/notifications?channel=CONSOLE')).json;
  assert.ok(notifs.some((n) => n.event === 'dispatch.exception' && n.body.includes(ref) && n.status === 'SENT'));
  assert.ok((await events(ref)).some((e) => e.status === 'EXCEPTION_DISPATCH'));

  // Relance : nouveau tour, les refus précédents ne comptent plus → Chama (0/5) est resollicitée.
  const retry = await as(admin, `/v1/dispatch/auto/${ref}/retry`, { method: 'POST', body: {} });
  assert.equal(retry.status, 200, JSON.stringify(retry.json));
  assert.equal(retry.json.kind, 'offer');
  assert.equal(retry.json.driver, 'Chama Test');
  assert.equal((await order(ref)).dispatchException, null);
  assert.ok(!(await as(admin, '/v1/dispatch/exceptions')).json.some((x) => x.ref === ref));
  // Relancer pendant une proposition en cours : refusé.
  assert.equal((await as(admin, `/v1/dispatch/auto/${ref}/retry`, { method: 'POST', body: {} })).status, 409);
  assert.equal((await respond('Chama Test', retry.json.offerId, 'accept')).status, 200);
});

test('zone non couverte → exception ZONE_NON_COUVERTE, jamais un livreur hors zone', async () => {
  const ref = await mkOrder(HORS);
  assert.equal((await offersOf(ref)).length, 0);
  assert.equal((await order(ref)).dispatchException, 'ZONE_NON_COUVERTE');
});

test('zone couverte mais personne en état → AUCUN_LIVREUR_DISPONIBLE', async () => {
  // Anfa : Elias indisponible, Farid sans compte d'app.
  const ref = await mkOrder(ANFA);
  assert.equal((await order(ref)).dispatchException, 'AUCUN_LIVREUR_DISPONIBLE');
});

test('capacité atteinte (capacité propre du livreur) → CAPACITE_ATTEINTE', async () => {
  // Dounia, seule sur Agdal, capacité 1.
  const ref1 = await mkOrder(AGDAL);
  const [p] = await pendingOf(ref1);
  assert.equal(p.driver, 'Dounia Test');
  // Tant que la proposition est en cours, elle compte déjà dans la charge.
  const ref2 = await mkOrder(AGDAL);
  assert.equal((await order(ref2)).dispatchException, 'CAPACITE_ATTEINTE');
  assert.equal((await respond('Dounia Test', p.id, 'accept')).status, 200);
  const ref3 = await mkOrder(AGDAL);
  assert.equal((await order(ref3)).dispatchException, 'CAPACITE_ATTEINTE');
  const exc = (await as(admin, '/v1/dispatch/exceptions')).json.map((x) => x.reason);
  assert.ok(exc.includes('ZONE_NON_COUVERTE') && exc.includes('AUCUN_LIVREUR_DISPONIBLE') && exc.includes('CAPACITE_ATTEINTE'));
  // Le dispatcher garde la main : affectation manuelle d'une exception.
  assert.equal((await as(admin, `/v1/orders/${ref3}/assign`, { method: 'POST', body: { driver: 'Amine Test' } })).status, 200);
  assert.ok(!(await as(admin, '/v1/dispatch/exceptions')).json.some((x) => x.ref === ref3));
});

test('concurrence : passes parallèles → une seule proposition ; acceptations parallèles → une seule affectation', async () => {
  // Commande créée automate coupé, puis rattrapée par 8 passes lancées en même temps
  // (en plus de la passe périodique de l'API).
  assert.equal((await settings({ autoDispatch: false })).status, 200);
  const ref = await mkOrder(MAARIF);
  assert.equal((await settings({ autoDispatch: true })).status, 200);
  const runs = await Promise.all(Array.from({ length: 8 }, () => as(admin, '/v1/dispatch/auto/run', { method: 'POST', body: {} })));
  assert.ok(runs.every((r) => r.status === 200));
  const all = await offersOf(ref);
  assert.equal(all.length, 1, `une seule proposition attendue, reçu ${JSON.stringify(all)}`);
  const offre = all[0];

  const acc = await Promise.all([
    respond(offre.driver, offre.id, 'accept', 'k1'),
    respond(offre.driver, offre.id, 'accept', 'k2'),
    respond(offre.driver, offre.id, 'accept', 'k3'),
  ]);
  assert.ok(acc.every((r) => r.status === 200), JSON.stringify(acc.map((r) => r.status)));
  const ev = await events(ref);
  assert.equal(ev.filter((e) => e.status === 'ASSIGNEE').length, 1);
  assert.equal((await order(ref)).driver, offre.driver);
});
