// Charge réaliste pour un livreur : N commandes (20 par défaut) affectées d'un coup, pour voir
// comment l'app livreur affiche une grosse journée (carte, tournée, regroupements, échéances).
//
//   ADMIN_MDP=… node qa/recette/vingt-commandes.mjs
//   API=… TENANT=portraildemo LIVREUR="Livreur Test" N=20 ADMIN_MDP=… node qa/recette/vingt-commandes.mjs
const API = process.env.API ?? 'https://transpo-api.wedowonders.com';
const TENANT = process.env.TENANT ?? 'portraildemo';
const LIVREUR = process.env.LIVREUR ?? 'Livreur Test';
const N = Number(process.env.N ?? 20);
const ADMIN = { email: process.env.ADMIN_EMAIL ?? `admin@${TENANT}.ma`, password: process.env.ADMIN_MDP };
if (!ADMIN.password) { console.error('ADMIN_MDP requis'); process.exit(1); }

async function appel(chemin, { method = 'GET', body, jeton } = {}) {
  const r = await fetch(API + chemin, {
    method,
    headers: { 'content-type': 'application/json', 'x-tenant-slug': TENANT, 'user-agent': 'Mozilla/5.0 recette', ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${chemin} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

// Quatre marchands (les retraits d'un même lieu se regroupent dans l'app) …
const MARCHANDS = [
  { name: 'Maison Argane', adresse: '14 rue Ahmed El Mokri, Maârif', lat: 33.5869, lng: -7.6328 },
  { name: 'Souk Digital', adresse: '80 bd Zerktouni', lat: 33.5893, lng: -7.6255 },
  { name: 'Pharmacie du Port', adresse: 'Bd des Almohades', lat: 33.6030, lng: -7.6150 },
  { name: 'Café Mokka', adresse: '12 bd d’Anfa, Racine', lat: 33.5905, lng: -7.6420 },
];
// … et des clients répartis sur Maârif, Gauthier, Racine, Bourgogne, Californie, Oasis.
const CLIENTS = [
  ['Adil C.', 'Résidence Al Andalous, bd Ghandi', 33.5795, -7.6460], ['Nadia T.', 'Bd Bir Anzarane', 33.5833, -7.6385],
  ['Houda B.', 'Rue des Pins, Californie', 33.5470, -7.6230], ['Omar B.', 'Rue Jean Jaurès, Gauthier', 33.5930, -7.6290],
  ['Leïla M.', 'Bd d’Anfa, Racine', 33.5912, -7.6445], ['Yassine K.', 'Rue Ibn Battouta, Bourgogne', 33.5975, -7.6460],
  ['Sara E.', 'Bd Abdelmoumen', 33.5780, -7.6230], ['Karim D.', 'Rue Mozart, Oasis', 33.5560, -7.6290],
  ['Imane R.', 'Bd Brahim Roudani', 33.5720, -7.6390], ['Hicham Z.', 'Rue Taha Hussein, Gauthier', 33.5905, -7.6240],
  ['Meryem A.', 'Bd Massira Al Khadra', 33.5830, -7.6520], ['Reda S.', 'Bd Moulay Youssef', 33.5950, -7.6320],
  ['Salma F.', 'Rue Abou Kacem Echabi', 33.5655, -7.6345], ['Anas L.', 'Bd Zerktouni, Triangle d’Or', 33.5880, -7.6360],
  ['Ghita B.', 'Rue Al Fourat, Maârif', 33.5800, -7.6340], ['Mehdi O.', 'Bd de Bordeaux', 33.5850, -7.6150],
  ['Rim H.', 'Rue Soumaya, Palmier', 33.5755, -7.6290], ['Ilyas N.', 'Bd Ghandi, Oasis', 33.5640, -7.6480],
  ['Khadija E.', 'Rue Normandie, Maârif', 33.5845, -7.6410], ['Yasmine T.', 'Bd Al Qods, Californie', 33.5410, -7.6320],
];
// Un délai sur une partie des commandes : de quoi voir les échéances et l'ordre « urgent d'abord ».
const DELAIS = [
  { mode: 'apres_commande', minutes: 45 }, { mode: 'apres_retrait', minutes: 30 },
  { mode: 'heure_limite', heure: null }, null, null, null, null,
];

const { token } = await appel('/v1/auth/login', { method: 'POST', body: ADMIN });
const heure = new Date(Date.now() + 3 * 3_600_000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });
for (let i = 0; i < N; i++) {
  const m = MARCHANDS[i % MARCHANDS.length];
  const [nom, adr, lat, lng] = CLIENTS[i % CLIENTS.length];
  const d = DELAIS[i % DELAIS.length];
  const delai = d ? (d.mode === 'heure_limite' ? { ...d, heure } : d) : undefined;
  const cod = i % 4 === 3 ? 0 : 50 * (3 + ((i * 7) % 20));
  const o = await appel('/v1/orders', { method: 'POST', jeton: token, body: {
    fromCity: 'Casablanca', toCity: 'Casablanca', merchant: m.name, pickupContact: m.name,
    pickupAddress: m.adresse, pickupLat: m.lat, pickupLng: m.lng,
    dropContact: nom, dropAddress: adr, dropLat: lat, dropLng: lng, dropPhone: '+212600000000',
    cod, size: ['Petit', 'Moyen', 'Petit', 'Grand'][i % 4], proofLevel: i % 3 === 0 ? 'signature' : 'aucune',
    ...(delai ? { delai } : {}),
  } });
  await appel(`/v1/orders/${o.ref}/assign`, { method: 'POST', jeton: token, body: { driver: LIVREUR } });
  console.log(`${String(i + 1).padStart(2)} ${o.ref} · ${m.name} → ${nom}${delai ? ` · ${delai.mode}` : ''}${cod ? ` · COD ${cod}` : ''}`);
}
