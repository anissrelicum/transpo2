// Société de test pour l'app livreur « Portrail Livreur », prête à l'emploi :
//  - une société dédiée (pas de risque de toucher les sociétés de démonstration) ;
//  - un livreur avec véhicule et papiers à jour, dans une zone couvrant Casablanca ;
//  - affectation automatique ACTIVE : chaque commande déposée par le marchand de test est
//    PROPOSÉE au livreur (3 minutes pour accepter) ;
//  - une journée déjà garnie : un retrait groupé de 3 colis chez un marchand, une livraison
//    déjà en main, une commande saisie sans GPS, et une proposition en attente.
//
//   node qa/recette/compte-test-livreur.mjs
//   API=… SAAS_EMAIL=… SAAS_MDP=… SLUG=portraildemo node qa/recette/compte-test-livreur.mjs
//
// Rejouable : la société et les comptes existants sont réutilisés, les mots de passe
// réinitialisés, et de nouvelles commandes ajoutées.
import { writeFileSync, mkdirSync } from 'node:fs';

const API = process.env.API ?? 'http://transpo-api.wedowonders.com';
const SLUG = process.env.SLUG ?? 'portraildemo';
const NOM = process.env.NOM ?? 'Portrail Démo';
const SAAS = { email: process.env.SAAS_EMAIL ?? 'ops@transpo.ma', password: process.env.SAAS_MDP ?? 'transpo' };
const LIVREUR = { name: 'Livreur Test', email: `livreur@${SLUG}.ma`, phone: '+212600112233' };
const MARCHAND = { name: 'Boutique Démo', gerant: 'Sara Marchande', email: `marchand@${SLUG}.ma` };
const SORTIE = new URL('./sortie/compte-test-livreur.json', import.meta.url);
const PROPRE = /^[A-Za-z0-9]+$/; // facile à taper sur un téléphone

async function appel(chemin, { method = 'GET', body, jeton, tenant } = {}) {
  const r = await fetch(API + chemin, {
    method,
    headers: {
      'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 recette',
      ...(tenant ? { 'x-tenant-slug': tenant } : {}),
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${chemin} → ${r.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

// 1. La société (provisionnée par la plateforme), et son administrateur.
const { token: saas } = await appel('/v1/auth/super/login', { method: 'POST', body: SAAS });
const societes = await appel('/v1/saas/tenants', { jeton: saas });
const liste = Array.isArray(societes) ? societes : societes.items ?? [];
let adminEmail = `admin@${SLUG}.ma`;
let adminMdp;
if (!liste.some((t) => t.slug === SLUG)) {
  const p = await appel('/v1/saas/tenants', { method: 'POST', jeton: saas, body: {
    slug: SLUG, name: NOM, city: 'Casablanca', adminEmail, adminName: 'Admin Démo',
  } });
  adminEmail = p.admin?.email ?? adminEmail;
  adminMdp = p.admin?.tempPassword;
}
if (!adminMdp) {
  // Société existante : on repasse par la plateforme pour un nouveau mot de passe admin.
  const t = liste.find((x) => x.slug === SLUG);
  const r = await appel(`/v1/saas/tenants/${t.id ?? SLUG}/reset-admin`, { method: 'POST', jeton: saas }).catch(() => null);
  adminMdp = r?.tempPassword;
  if (!adminMdp) throw new Error('Société déjà créée : fournir ADMIN_MDP (mot de passe admin) pour rejouer.');
}
adminMdp = process.env.ADMIN_MDP ?? adminMdp;
const { token: admin } = await appel('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email: adminEmail, password: adminMdp } });
const A = (chemin, opts = {}) => appel(chemin, { ...opts, jeton: admin });

// 2. Véhicule, livreur, zone, affectation automatique.
const an = new Date().getFullYear();
const parc = await A('/v1/vehicles');
const moto = parc.find((v) => v.plate === '12345-A-6') ?? await A('/v1/vehicles', { method: 'POST', body: {
  plate: '12345-A-6', type: 'Moto', city: 'Casablanca', insuranceDue: `${an + 1}-03-31`, ctDue: `${an + 1}-06-30`,
} });
const effectif = await A('/v1/drivers');
let fiche = effectif.find((d) => d.name === LIVREUR.name);
if (!fiche) {
  fiche = await A('/v1/drivers', { method: 'POST', body: {
    name: LIVREUR.name, city: 'Casablanca', vehicle: 'Moto', phone: LIVREUR.phone, licenseNo: 'TEST0001',
    licenseDue: `${an + 4}-05-31`, medicalDue: `${an + 1}-11-30`, available: true,
  } });
}
await A(`/v1/drivers/${fiche.id}/vehicle`, { method: 'PATCH', body: { vehicleId: moto.id } });

const zones = await A('/v1/dispatch/zones');
let zone = zones.find((z) => z.nameFr === 'Grand Casablanca');
if (!zone) {
  zone = await A('/v1/dispatch/zones', { method: 'POST', body: {
    nameFr: 'Grand Casablanca', nameAr: 'الدار البيضاء الكبرى', color: 'indigo',
    region: 'Casablanca-Settat', province: 'Casablanca', commune: 'Casablanca',
    centerLat: 33.575, centerLng: -7.6,
    polygon: [[33.68, -7.78], [33.68, -7.42], [33.45, -7.42], [33.45, -7.78]],
  } });
}
await A(`/v1/dispatch/zones/${zone.id}`, { method: 'PATCH', body: { drivers: [LIVREUR.name] } });
await A('/v1/dispatch/settings', { method: 'PUT', body: { autoDispatch: true, offerTimeoutMin: 3, defaultDailyCapacity: 20 } });

// 3. Comptes livreur et marchand, mots de passe faciles à taper.
const utilisateurs = await A('/v1/users');
async function compte({ email, name, role, merchant, driver }) {
  const deja = utilisateurs.find((u) => u.email === email);
  let id; let password;
  if (deja) id = deja.id;
  else ({ id, tempPassword: password } = await A('/v1/users', { method: 'POST', body: { email, name, role, merchant, driver } }));
  for (let i = 0; !password || !PROPRE.test(password); i++) {
    if (i > 30) throw new Error(`${email} : pas de mot de passe simple`);
    ({ tempPassword: password } = await A(`/v1/users/${id}/reset-password`, { method: 'POST' }));
  }
  return password;
}
const mdpLivreur = await compte({ email: LIVREUR.email, name: LIVREUR.name, role: 'DRIVER', driver: LIVREUR.name });
const mdpMarchand = await compte({ email: MARCHAND.email, name: MARCHAND.gerant, role: 'MERCHANT', merchant: MARCHAND.name });

// 4. La journée : des commandes affectées au livreur, à différentes étapes.
const RETRAIT = {
  merchant: MARCHAND.name, pickupContact: MARCHAND.name, pickupPhone: '+212522000111',
  pickupAddress: '14 rue Ahmed El Mokri, Maârif', pickupLat: 33.5869, pickupLng: -7.6328,
  pickupNotes: 'Sonner à l’atelier, au fond de la cour.',
};
const JOURNEE = [
  { dropContact: 'Adil C.', dropAddress: 'Résidence Al Andalous, bd Ghandi', dropLat: 33.5795, dropLng: -7.6460, cod: 1090, proofLevel: 'signature', size: 'Petit', dropNotes: 'Interphone 12, 3e étage, appelez en arrivant.' },
  { dropContact: 'Nadia T.', dropAddress: 'Bd Bir Anzarane, Maârif', dropLat: 33.5833, dropLng: -7.6385, cod: 420, proofLevel: 'photo', size: 'Petit' },
  { dropContact: 'Houda B.', dropAddress: 'Rue des Pins, Californie', dropLat: 33.5470, dropLng: -7.6230, cod: 620, proofLevel: 'photo_signature', size: 'Moyen', fragile: true },
];
const creees = [];
for (const l of JOURNEE) {
  const o = await A('/v1/orders', { method: 'POST', body: { fromCity: 'Casablanca', toCity: 'Casablanca', dropPhone: '+212600000000', ...RETRAIT, ...l } });
  await A(`/v1/orders/${o.ref}/assign`, { method: 'POST', body: { driver: LIVREUR.name } });
  creees.push(o.ref);
}
// Une livraison déjà récupérée (colis en main), ailleurs en ville.
const { token: livreur } = await appel('/v1/auth/login', { method: 'POST', body: { email: LIVREUR.email, password: mdpLivreur } });
const enMain = await A('/v1/orders', { method: 'POST', body: {
  fromCity: 'Casablanca', toCity: 'Casablanca', merchant: 'Pharmacie du Port', pickupContact: 'Pharmacie du Port',
  pickupAddress: 'Bd des Almohades', pickupLat: 33.6030, pickupLng: -7.6150,
  dropContact: 'Omar B.', dropAddress: 'Rue Jean Jaurès, Gauthier', dropLat: 33.5930, dropLng: -7.6290,
  dropPhone: '+212600000001', cod: 0, proofLevel: 'aucune', size: 'Petit',
} });
await A(`/v1/orders/${enMain.ref}/assign`, { method: 'POST', body: { driver: LIVREUR.name } });
// ASSIGNEE → RETRAIT → RECUPEREE : le livreur a déjà le colis.
for (let i = 0; i < 2; i++) await appel(`/v1/driver/orders/${enMain.ref}/advance`, { method: 'POST', jeton: livreur, body: {} });
// Une commande saisie sans GPS (adresse texte seule) : l'app ne lui invente pas de position.
const texte = await A('/v1/orders', { method: 'POST', body: {
  fromCity: 'Casablanca', toCity: 'Mohammedia', merchant: MARCHAND.name, pickupContact: MARCHAND.name,
  pickupAddress: '14 rue Ahmed El Mokri, Maârif', pickupLat: 33.5869, pickupLng: -7.6328,
  dropContact: 'Yassine K.', dropAddress: 'Avenue Hassan II, Mohammedia', dropPhone: '+212600000002',
  cod: 250, proofLevel: 'signature', size: 'Grand',
} });
await A(`/v1/orders/${texte.ref}/assign`, { method: 'POST', body: { driver: LIVREUR.name } });

// 5. Une proposition : déposée par le marchand, placée par l'affectation automatique.
const { token: marchand } = await appel('/v1/auth/login', { method: 'POST', body: { email: MARCHAND.email, password: mdpMarchand } });
const offre = await appel('/v1/orders', { method: 'POST', jeton: marchand, body: {
  fromCity: 'Casablanca', toCity: 'Casablanca', pickupContact: MARCHAND.name,
  pickupAddress: '22 rue Ibnou Mounir, Maârif', pickupLat: 33.5845, pickupLng: -7.6370,
  dropContact: 'Leïla M.', dropAddress: 'Bd d’Anfa, Racine', dropLat: 33.5905, dropLng: -7.6420,
  dropPhone: '+212600000003', cod: 340, proofLevel: 'photo', size: 'Petit',
} });
await A('/v1/dispatch/auto/run', { method: 'POST' }).catch(() => null);

const resultat = {
  api: API, societe: SLUG, emisLe: new Date().toISOString(),
  livreur: { email: LIVREUR.email, password: mdpLivreur },
  marchand: { email: MARCHAND.email, password: mdpMarchand, usage: 'console : déposer une commande → proposée au livreur' },
  admin: { email: adminEmail, password: adminMdp },
  commandes: { retraitGroupe: creees, enMain: enMain.ref, sansGps: texte.ref, proposee: offre.ref },
};
mkdirSync(new URL('./sortie/', import.meta.url), { recursive: true });
writeFileSync(SORTIE, `${JSON.stringify(resultat, null, 2)}\n`);
console.log(JSON.stringify(resultat, null, 2));
