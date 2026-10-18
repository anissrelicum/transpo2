// Simulation d'une flotte de livreurs pour le PC flotte de la console.
//
// Dix livreurs répartis sur trois zones de Casablanca roulent VRAIMENT vers leurs arrêts :
// position envoyée toutes les 4 s par l'API livreur (comme l'app), statuts avancés comme
// sur le terrain (en route, récupéré, en livraison), livraison avec encaissement ou échec.
// Un livreur sort régulièrement de sa zone, un autre zigzague (itinéraire non optimisé)
// pour que les alertes et l'indicateur « km par livraison » aient quelque chose à montrer.
// Quand un livreur a fini, il reçoit de nouvelles commandes : la démo tourne sans fin.
//
//   API=http://transpo-api.wedowonders.com TENANT=portraildemo \
//   ADMIN_EMAIL=admin@portraildemo.ma ADMIN_MDP=… node qa/simulation/flotte.mjs
//
// ACCEL (défaut 4) : facteur d'accélération des déplacements, pour voir bouger la flotte.

const API = process.env.API ?? 'http://transpo-api.wedowonders.com';
const TENANT = process.env.TENANT ?? 'portraildemo';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? `admin@${TENANT}.ma`, password: process.env.ADMIN_MDP };
const ACCEL = Number(process.env.ACCEL ?? 4);
const TICK_MS = 4000;
const PAR_LIVREUR = 4;

if (!ADMIN.password) { console.error('ADMIN_MDP requis'); process.exit(1); }

const ZONES = [
  { nameFr: 'Casa Ouest', nameAr: 'الدار البيضاء الغربية', color: 'indigo', commune: 'Maârif', poly: [[33.605, -7.675], [33.605, -7.625], [33.560, -7.625], [33.560, -7.675]] },
  { nameFr: 'Casa Centre', nameAr: 'وسط الدار البيضاء', color: 'amber', commune: 'Mers Sultan', poly: [[33.605, -7.625], [33.605, -7.585], [33.560, -7.585], [33.560, -7.625]] },
  { nameFr: 'Casa Est', nameAr: 'الدار البيضاء الشرقية', color: 'cyan', commune: 'Roches Noires', poly: [[33.615, -7.585], [33.615, -7.535], [33.565, -7.535], [33.565, -7.585]] },
];
const LIVREURS = [
  // `tours` : compteur de relevés, pour lire les propositions toutes les 3 passes.
  { name: 'Yassine Alaoui', vehicle: 'Moto', zone: 0, kmh: 32 },
  { name: 'Salma Bennis', vehicle: 'Moto', zone: 0, kmh: 30 },
  { name: 'Hamza Ouazzani', vehicle: 'Moto', zone: 0, kmh: 34, fugueur: true },
  { name: 'Khadija Tahiri', vehicle: 'Utilitaire', zone: 1, kmh: 26 },
  { name: 'Mehdi Lahlou', vehicle: 'Moto', zone: 1, kmh: 33, zigzag: true },
  { name: 'Rania Sebti', vehicle: 'Moto', zone: 1, kmh: 31 },
  { name: 'Anas Berrada', vehicle: 'Fourgon', zone: 1, kmh: 24 },
  { name: 'Imad Chafik', vehicle: 'Moto', zone: 2, kmh: 32 },
  { name: 'Zineb Kettani', vehicle: 'Utilitaire', zone: 2, kmh: 27 },
  { name: 'Omar Fassi', vehicle: 'Moto', zone: 2, kmh: 33 },
];
const MARCHANDS = ['Maison Argane', 'Souk Digital', 'Pharmacie du Port', 'Atelier Zellige', 'Café Mokka', 'Librairie Al Kitab'];
const CLIENTS = ['Adil C.', 'Nadia T.', 'Houda B.', 'Omar B.', 'Leïla M.', 'Yassine K.', 'Sara E.', 'Karim D.', 'Imane R.', 'Hicham Z.', 'Meryem A.', 'Reda S.'];
const RUES = ['bd Ghandi', 'bd Bir Anzarane', 'rue Ibnou Mounir', 'bd d’Anfa', 'rue Jean Jaurès', 'bd Zerktouni', 'bd Mohammed V', 'rue Allal Ben Abdellah', 'bd Moulay Youssef', 'bd de la Résistance'];
const SIGN = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const hasard = (t) => t[Math.floor(Math.random() * t.length)];
const dans = (poly) => {
  const lats = poly.map((p) => p[0]); const lngs = poly.map((p) => p[1]);
  const m = 0.004; // à l'écart des bords
  return [Math.min(...lats) + m + Math.random() * (Math.max(...lats) - Math.min(...lats) - 2 * m),
          Math.min(...lngs) + m + Math.random() * (Math.max(...lngs) - Math.min(...lngs) - 2 * m)];
};
const metres = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

async function appel(chemin, { method = 'GET', body, jeton, idem } = {}) {
  const r = await fetch(API + chemin, {
    method,
    headers: {
      'content-type': 'application/json', 'x-tenant-slug': TENANT, 'user-agent': 'Mozilla/5.0 simulation-flotte',
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}), ...(idem ? { 'idempotency-key': idem } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) { const e = new Error(`${method} ${chemin} → ${r.status} ${txt.slice(0, 200)}`); e.status = r.status; throw e; }
  return txt ? JSON.parse(txt) : null;
}

let admin;
const A = (chemin, opts = {}) => appel(chemin, { ...opts, jeton: admin });
async function connexionAdmin() { admin = (await appel('/v1/auth/login', { method: 'POST', body: ADMIN })).token; }

// ------------------------------------------------------------ mise en place (idempotente)
async function installer() {
  await connexionAdmin();
  const reglages = await A('/v1/dispatch/settings');
  // Les commandes de la simulation sont affectées directement : l'automate est coupé le
  // temps de les créer, sinon il les proposerait avant l'affectation.
  await A('/v1/dispatch/settings', { method: 'PUT', body: { autoDispatch: false } });

  const an = new Date().getFullYear();
  const parc = await A('/v1/vehicles');
  const effectif = await A('/v1/drivers');
  for (const [i, l] of LIVREURS.entries()) {
    let f = effectif.find((d) => d.name === l.name);
    if (!f) {
      f = await A('/v1/drivers', { method: 'POST', body: {
        name: l.name, city: 'Casablanca', vehicle: l.vehicle, phone: `+21266${String(1000000 + i * 7919).slice(0, 7)}`,
        licenseNo: `SIM${1000 + i}`, licenseDue: `${an + 3}-06-30`, medicalDue: `${an + 1}-12-31`, available: true,
      } });
    }
    const plaque = `${20000 + i}-B-6`;
    const v = parc.find((x) => x.plate === plaque) ?? await A('/v1/vehicles', { method: 'POST', body: {
      plate: plaque, type: l.vehicle, city: 'Casablanca', insuranceDue: `${an + 1}-03-31`, ctDue: `${an + 1}-06-30`,
    } });
    await A(`/v1/drivers/${f.id}/vehicle`, { method: 'PATCH', body: { vehicleId: v.id } });
  }

  const zones = await A('/v1/dispatch/zones');
  for (const [i, z] of ZONES.entries()) {
    let zone = zones.find((x) => x.nameFr === z.nameFr);
    const lats = z.poly.map((p) => p[0]); const lngs = z.poly.map((p) => p[1]);
    if (!zone) {
      zone = await A('/v1/dispatch/zones', { method: 'POST', body: {
        nameFr: z.nameFr, nameAr: z.nameAr, color: z.color, region: 'Casablanca-Settat', province: 'Casablanca', commune: z.commune,
        centerLat: (Math.min(...lats) + Math.max(...lats)) / 2, centerLng: (Math.min(...lngs) + Math.max(...lngs)) / 2, polygon: z.poly,
      } });
    }
    await A(`/v1/dispatch/zones/${zone.id}`, { method: 'PATCH', body: { drivers: LIVREURS.filter((l) => l.zone === i).map((l) => l.name) } });
  }

  // Comptes livreurs (mot de passe renouvelé à chaque démarrage : seule la simulation s'en sert).
  const utilisateurs = await A('/v1/users');
  for (const l of LIVREURS) {
    const email = `${l.name.split(' ')[0].toLowerCase()}.sim@${TENANT}.ma`;
    const u = utilisateurs.find((x) => x.email === email);
    const { tempPassword } = u
      ? await A(`/v1/users/${u.id}/reset-password`, { method: 'POST' })
      : await A('/v1/users', { method: 'POST', body: { email, name: l.name, role: 'DRIVER', driver: l.name } });
    l.email = email; l.password = tempPassword;
    l.jeton = (await appel('/v1/auth/login', { method: 'POST', body: { email, password: tempPassword } })).token;
  }

  // Missions en cours de chaque livreur ; on complète jusqu'à PAR_LIVREUR.
  const toutes = await A('/v1/orders');
  for (const l of LIVREURS) {
    l.pos = l.pos ?? dans(ZONES[l.zone].poly);
    const miennes = toutes.filter((o) => o.driver === l.name && ['ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'].includes(o.status));
    for (let k = miennes.length; k < PAR_LIVREUR; k++) await nouvelleCommande(l);
  }
  await A('/v1/dispatch/settings', { method: 'PUT', body: { autoDispatch: reglages.autoDispatch } });
  console.log(`installé : ${LIVREURS.length} livreurs, ${ZONES.length} zones`);
}

function delaiAuHasard() {
  const x = Math.random();
  if (x < 0.15) return { delai: { mode: 'apres_retrait', minutes: 25 } };            // restaurant
  if (x < 0.35) return { delai: { mode: 'apres_commande', minutes: 45 } };           // express
  if (x < 0.45) {                                                                     // documents
    const h = new Date(Date.now() + 90 * 60_000);
    const hhmm = h.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });
    return { delai: { mode: 'heure_limite', heure: hhmm } };
  }
  return {};
}

async function nouvelleCommande(l) {
  const z = ZONES[l.zone].poly;
  const p = dans(z); const d = dans(z);
  const cod = Math.random() < 0.75 ? 50 * (2 + Math.floor(Math.random() * 20)) : 0;
  const o = await A('/v1/orders', { method: 'POST', body: {
    fromCity: 'Casablanca', toCity: 'Casablanca', merchant: hasard(MARCHANDS), size: hasard(['Petit', 'Petit', 'Moyen', 'Grand']),
    pickupContact: hasard(MARCHANDS), pickupAddress: `${10 + Math.floor(Math.random() * 90)} ${hasard(RUES)}`, pickupLat: p[0], pickupLng: p[1],
    dropContact: hasard(CLIENTS), dropAddress: `${1 + Math.floor(Math.random() * 120)} ${hasard(RUES)}`, dropLat: d[0], dropLng: d[1],
    dropPhone: '+212600000000', cod, proofLevel: Math.random() < 0.3 ? 'signature' : 'aucune',
    // Une part des commandes porte un délai (ADR 0006) : de quoi voir l'urgence et les retards.
    ...delaiAuHasard(),
  } });
  await A(`/v1/orders/${o.ref}/assign`, { method: 'POST', body: { driver: l.name } });
}

// ------------------------------------------------------------ la journée, en boucle
async function terrain(l, chemin, opts = {}) {
  try { return await appel(chemin, { ...opts, jeton: l.jeton }); } catch (e) {
    if (e.status === 401) { // jeton expiré : on se reconnecte
      l.jeton = (await appel('/v1/auth/login', { method: 'POST', body: { email: l.email, password: l.password } })).token;
      return appel(chemin, { ...opts, jeton: l.jeton });
    }
    throw e;
  }
}

function cibleDe(o) {
  const retrait = o.status === 'ASSIGNEE' || o.status === 'RETRAIT';
  return retrait ? [o.pickupLat, o.pickupLng] : [o.dropLat, o.dropLng];
}

async function etape(l) {
  // Missions proposées par l'affectation automatique : acceptées après quelques secondes
  // (9 fois sur 10), comme un livreur qui regarde son téléphone au feu rouge.
  if (++l.tours % 3 === 0) {
    const offres = await terrain(l, '/v1/driver/offers').catch(() => []);
    for (const f of offres) {
      const decision = Math.random() < 0.9 ? 'accept' : 'refuse';
      await terrain(l, `/v1/driver/offers/${f.id}/${decision}`, { method: 'POST', body: {}, idem: `${f.id}:sim:${decision}` }).catch(() => null);
      if (decision === 'accept') l.rafraichir = true;
    }
  }
  if (!l.missions || l.rafraichir) {
    l.missions = (await terrain(l, '/v1/driver/missions')).filter((o) => o.pickupLat != null && o.dropLat != null);
    l.rafraichir = false;
    if (!l.missions.length) {
      for (let k = 0; k < PAR_LIVREUR; k++) await nouvelleCommande(l);
      l.rafraichir = true;
      return;
    }
  }
  // Le prochain arrêt : le plus proche (le livreur « zigzag » prend le plus LOIN, pour que
  // l'indicateur km/livraison du PC flotte ait un mauvais élève à montrer).
  const tri = [...l.missions].sort((a, b) => metres(l.pos, cibleDe(a)) - metres(l.pos, cibleDe(b)));
  const o = l.zigzag ? tri[tri.length - 1] : tri[0];
  // Le « fugueur » fait de temps en temps un détour hors de sa zone (pause, course perso…).
  if (l.fugueur && !l.detour && Math.random() < 0.02) {
    const z = ZONES[l.zone].poly;
    l.detour = [Math.min(...z.map((p) => p[0])) - 0.012, Math.min(...z.map((p) => p[1])) + 0.01];
  }
  const cible = l.detour ?? cibleDe(o);

  // En route : le statut suit le geste (comme « Naviguer » dans l'app).
  if (!l.detour && (o.status === 'ASSIGNEE' || o.status === 'RECUPEREE')) {
    o.status = (await terrain(l, `/v1/driver/orders/${o.ref}/advance`, { method: 'POST', body: {}, idem: `${o.ref}:sim:${o.status}` })).status;
  }

  const pas = (l.kmh * ACCEL * 1000 / 3600) * (TICK_MS / 1000);
  const d = metres(l.pos, cible);
  if (d > pas) {
    const t = pas / d;
    // Un peu de bruit latéral : un livreur ne roule pas en ligne parfaitement droite.
    const bruit = () => (Math.random() - 0.5) * 0.0002;
    l.pos = [l.pos[0] + (cible[0] - l.pos[0]) * t + bruit(), l.pos[1] + (cible[1] - l.pos[1]) * t + bruit()];
  } else {
    l.pos = [...cible];
    if (l.detour) { l.detour = null; }
    else if (o.status === 'RETRAIT') {
      o.status = (await terrain(l, `/v1/driver/orders/${o.ref}/advance`, { method: 'POST', body: {}, idem: `${o.ref}:sim:RETRAIT` })).status;
    } else if (o.status === 'LIVRAISON') {
      if (Math.random() < 0.08) {
        await terrain(l, `/v1/driver/orders/${o.ref}/fail`, { method: 'POST', body: { reason: 'Client injoignable — simulation' }, idem: `${o.ref}:sim:fail` });
      } else {
        await terrain(l, `/v1/driver/orders/${o.ref}/proof`, { method: 'POST', idem: `${o.ref}:sim:proof`, body: {
          codCollected: o.cod, ...(o.proofLevel === 'signature' ? { signature: SIGN } : {}),
        } });
      }
      l.missions = l.missions.filter((x) => x.ref !== o.ref);
      if (l.missions.length === 0) l.missions = null;
    }
  }
  await terrain(l, '/v1/tracking/position', { method: 'POST', body: { lat: l.pos[0], lng: l.pos[1] } });
}

await installer();
let tour = 0;
for (const l of LIVREURS) l.tours = 0;
for (;;) {
  const debut = Date.now();
  await Promise.all(LIVREURS.map((l) => etape(l).catch((e) => { console.warn(`${l.name} : ${e.message}`); l.rafraichir = true; })));
  if (++tour % 150 === 0) { // toutes les ~10 min : jeton admin frais
    await connexionAdmin().catch(() => undefined);
    console.log(`${new Date().toISOString()} · ${tour} relevés`);
  }
  await pause(Math.max(0, TICK_MS - (Date.now() - debut)));
}
