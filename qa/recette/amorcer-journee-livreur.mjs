// Jeu de test de l'app livreur « Ma journée » : des commandes GÉOLOCALISÉES (retrait et
// livraison) affectées à un livreur, pour voir la carte, l'ordre des arrêts, la détection
// d'arrivée et l'encaissement sur de vraies coordonnées.
//
//   node qa/recette/amorcer-journee-livreur.mjs
//   API=http://transpo-api.wedowonders.com TENANT=atlasexpress LIVREUR="Youssef Amrani" \
//   ADMIN_EMAIL=... ADMIN_MDP=... node qa/recette/amorcer-journee-livreur.mjs
//
// Sans ADMIN_EMAIL/ADMIN_MDP, les comptes viennent de qa/demo/sortie/comptes.json.
import { readFileSync } from 'node:fs';

const API = process.env.API ?? 'http://transpo-api.wedowonders.com';
const TENANT = process.env.TENANT ?? 'atlasexpress';
const LIVREUR = process.env.LIVREUR ?? 'Youssef Amrani';

function compteAdmin() {
  if (process.env.ADMIN_EMAIL) return { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_MDP };
  const d = JSON.parse(readFileSync(new URL('../demo/sortie/comptes.json', import.meta.url), 'utf8'));
  return d.comptes.find((c) => c.role === 'ADMIN');
}

async function appel(chemin, { method = 'GET', body, jeton } = {}) {
  const r = await fetch(API + chemin, {
    method,
    headers: {
      'content-type': 'application/json', 'x-tenant-slug': TENANT, 'user-agent': 'Mozilla/5.0 recette',
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${chemin} → ${r.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

// Maârif / Gauthier / Californie : un retrait commun et quatre livraisons dispersées.
const RETRAIT = {
  merchant: 'Maison Argane', pickupContact: 'Maison Argane', pickupPhone: '+212522000111',
  pickupAddress: '14 rue Ahmed El Mokri, Maârif', pickupLat: 33.5869, pickupLng: -7.6328,
  pickupNotes: 'Sonner à l’atelier, au fond de la cour.',
};
const LIVRAISONS = [
  { dropContact: 'Adil C.', dropAddress: 'Résidence Al Andalous, bd Ghandi', dropLat: 33.5795, dropLng: -7.6460, cod: 1090, proofLevel: 'signature', size: 'Petit', dropNotes: 'Interphone 12, 3e étage, appelez en arrivant.' },
  { dropContact: 'Nadia T.', dropAddress: 'Bd Bir Anzarane, Maârif', dropLat: 33.5833, dropLng: -7.6385, cod: 420, proofLevel: 'photo', size: 'Petit' },
  { dropContact: 'Houda B.', dropAddress: 'Rue des Pins, Californie', dropLat: 33.5470, dropLng: -7.6230, cod: 620, proofLevel: 'photo_signature', size: 'Moyen', fragile: true },
  { dropContact: 'Omar B.', dropAddress: 'Rue Jean Jaurès, Gauthier', dropLat: 33.5930, dropLng: -7.6290, cod: 0, proofLevel: 'aucune', size: 'Petit' },
];

const { email, password } = compteAdmin();
const { token } = await appel('/v1/auth/login', { method: 'POST', body: { email, password } });
for (const l of LIVRAISONS.slice(Number(process.env.DEPUIS ?? 0))) {
  const o = await appel('/v1/orders', { method: 'POST', jeton: token, body: {
    fromCity: 'Casablanca', toCity: 'Casablanca', dropPhone: '+212600000000', ...RETRAIT, ...l,
  } });
  await appel(`/v1/orders/${o.ref}/assign`, { method: 'POST', jeton: token, body: { driver: LIVREUR } });
  console.log(`${o.ref} (${o.code}) → ${LIVREUR} · ${l.dropContact} · COD ${l.cod}`);
}
