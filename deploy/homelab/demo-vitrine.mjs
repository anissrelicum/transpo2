// Organisation de démonstration, pour les captures du site vitrine.
//
// Le site montre de VRAIES copies d'écran du logiciel. Les montrer sur les données de la
// recette donnerait « Pagination Test » et « Boutique Test » à un prospect — le logiciel est
// réel, les données ne doivent pas avoir l'air d'un test. Ce script pose donc une
// organisation dédiée, avec des marchands, des villes et des montants plausibles, puis
// laisse le produit faire le reste : les courses sont créées, affectées, livrées et
// encaissées PAR L'API, pas écrites en base.
//
//   API_URL=http://transpo-api.wedowonders.com node deploy/homelab/demo-vitrine.mjs
import { execSync } from 'node:child_process';

const API = process.env.API_URL || 'http://localhost:3000';
const SLUG = process.env.DEMO_SLUG || 'demoexpress';
const SUPER = { email: process.env.SUPER_ADMIN_EMAIL || 'ops@transpo.ma',
                password: process.env.SUPER_ADMIN_PASSWORD || 'transpo' };
const MDP = 'Demo1234';

const MARCHANDS = ['Atlas Cosmétiques', 'Souk Électro', 'Maison Zellige', 'Pharma Anfa', 'Argan & Co'];
const CHAUFFEURS = [
  { nom: 'Hamid Ouali', ville: 'Casablanca' },
  { nom: 'Sara Bennis', ville: 'Casablanca' },
  { nom: 'Youssef Berrada', ville: 'Rabat' },
  { nom: 'Meryem Haddadi', ville: 'Rabat' },
];
const DESTINATAIRES = [
  'Khadija Amrani', 'Omar Sabri', 'Nadia Tazi', 'Rachid Benjelloun', 'Salma Idrissi',
  'Karim Cherkaoui', 'Leila Mansouri', 'Hicham Belkadi', 'Imane Ouazzani', 'Anas Sefrioui',
];
const ADRESSES = [
  '12 rue Ibn Batouta, Maârif', '45 bd Anfa, 3ᵉ étage', '8 avenue Hassan II',
  '77 rue de la Liberté', '23 lotissement Riad, villa 4', '5 rue Oued Sebou, Agdal',
];
const LIAISONS = [
  ['Casablanca', 'Rabat'], ['Casablanca', 'Casablanca'], ['Rabat', 'Salé'],
  ['Casablanca', 'Mohammedia'], ['Rabat', 'Kénitra'], ['Casablanca', 'El Jadida'],
  ['Rabat', 'Rabat'], ['Casablanca', 'Bouskoura'],
];

async function appel(chemin, { method = 'GET', body, jeton, tenant } = {}) {
  const r = await fetch(`${API}${chemin}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(tenant ? { 'x-tenant-slug': tenant } : {}),
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, donnees: t ? JSON.parse(t) : null };
}

function compteCli(tenant, email, nom, role, motDePasse, scope) {
  const args = `${tenant} ${email} '${nom}' ${role} ${motDePasse}${scope ? ` '${scope}'` : ''}`;
  const base = process.env.ACCOUNT_EXEC || 'pnpm --filter @transpo/db account';
  const cmd = base.includes('%ARGS%') ? base.replace('%ARGS%', args) : `${base} ${args}`;
  return execSync(cmd, { encoding: 'utf-8' }).trim().split('\n').pop();
}

const pioche = (t, i) => t[i % t.length];
// Montants ronds et crédibles, pas des nombres tirés au hasard à la virgule près.
const MONTANTS = [120, 180, 220, 260, 320, 380, 450, 540, 640, 780, 890, 1200];

const sup = await appel('/v1/auth/super/login', { method: 'POST', body: SUPER });
if (!sup.ok) throw new Error(`super-admin : ${sup.status}`);
const jetonSuper = sup.donnees.token;

const parc = (await appel('/v1/saas/tenants', { jeton: jetonSuper })).donnees ?? [];
if (!parc.some((t) => t.slug === SLUG)) {
  const p = await appel('/v1/saas/tenants', {
    method: 'POST', jeton: jetonSuper,
    body: { slug: SLUG, name: 'Demo Express', city: 'Casablanca', planCode: 'transporteur',
            adminEmail: `admin@${SLUG}.ma`, adminName: 'Nadia Alaoui' },
  });
  if (!p.ok) throw new Error(`provisioning : ${p.status} ${JSON.stringify(p.donnees)}`);
  console.log(`  organisation ${SLUG} provisionnée`);
}
// Abonnement actif : une organisation en essai affiche un bandeau qui n'a rien à faire
// sur une copie d'écran commerciale.
const abo = (await appel(`/v1/saas/tenants/${SLUG}/subscription`, { jeton: jetonSuper })).donnees;
if (abo?.status !== 'ACTIF') {
  await appel(`/v1/saas/tenants/${SLUG}/subscription`, {
    method: 'POST', jeton: jetonSuper, body: { planCode: 'entreprise', immediate: true },
  });
  console.log('  abonnement Entreprise actif');
}

compteCli(SLUG, `admin@${SLUG}.ma`, 'Nadia Alaoui', 'ADMIN', MDP);
const co = await appel('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email: `admin@${SLUG}.ma`, password: MDP } });
if (!co.ok) throw new Error(`connexion admin : ${co.status}`);
const jeton = co.donnees.token;
const api = (chemin, opts = {}) => appel(chemin, { ...opts, jeton, tenant: SLUG });

// --- Flotte -----------------------------------------------------------------
const an = new Date().getFullYear();
const vehicules = (await api('/v1/vehicles')).donnees ?? [];
for (const [i, plaque] of ['4412-A-12', '7781-B-05', '2093-C-31', '5520-A-44'].entries()) {
  if (vehicules.some((v) => v.plate === plaque)) continue;
  await api('/v1/vehicles', { method: 'POST', body: {
    plate: plaque, type: i % 2 ? 'Fourgon' : 'Utilitaire', city: i < 2 ? 'Casablanca' : 'Rabat',
    insuranceDue: `${an + 1}-0${(i % 9) + 1}-28`, inspectionDue: `${an + 1}-1${i % 2}-15`,
  } });
}
const chauffeurs = (await api('/v1/drivers')).donnees ?? [];
for (const c of CHAUFFEURS) {
  if (chauffeurs.some((d) => d.name === c.nom)) continue;
  await api('/v1/drivers', { method: 'POST', body: {
    name: c.nom, city: c.ville, vehicle: 'Fourgon', phone: '+212600112233',
    licenseNo: 'AB' + Math.floor(100000 + Math.random() * 899999),
    licenseDue: `${an + 2}-06-30`, medicalDue: `${an + 1}-11-30`, available: true,
  } });
}
console.log(`  flotte : ${CHAUFFEURS.length} chauffeurs, 4 véhicules`);

// --- Un compte livreur, pour les captures de l'application mobile ------------
compteCli(SLUG, `livreur@${SLUG}.ma`, 'Hamid Ouali', 'DRIVER', MDP, 'Hamid Ouali');

// --- Les courses ------------------------------------------------------------
const existantes = (await api('/v1/orders')).donnees ?? [];
const dejaLa = Array.isArray(existantes) ? existantes.length : (existantes.items?.length ?? 0);
if (dejaLa >= 30) {
  console.log(`  ${dejaLa} courses déjà en place — rien à créer`);
} else {
  const refs = [];
  for (let i = 0; i < 34; i += 1) {
    const [de, vers] = pioche(LIAISONS, i);
    const cod = i % 3 === 0 ? 0 : pioche(MONTANTS, i * 3 + 1);
    const r = await api('/v1/orders', { method: 'POST', body: {
      merchant: pioche(MARCHANDS, i), fromCity: de, toCity: vers, cod,
      size: ['Petit', 'Moyen', 'Grand'][i % 3],
      proofLevel: cod > 400 ? 'photo_signature' : cod > 0 ? 'photo' : 'aucune',
      dropContact: pioche(DESTINATAIRES, i), dropPhone: '+2126' + String(10000000 + i * 137).slice(0, 8),
      dropAddress: pioche(ADRESSES, i), dropNotes: i % 5 === 0 ? 'Interphone au nom du voisin' : undefined,
      pickupContact: pioche(MARCHANDS, i), pickupAddress: 'Entrepôt ' + de,
    } });
    if (r.ok) refs.push(r.donnees.ref);
  }
  console.log(`  ${refs.length} courses créées`);

  // Affectations et avancement : par les routes du produit, pas par la base.
  const livreur = await appel('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email: `livreur@${SLUG}.ma`, password: MDP } });
  const jetonLivreur = livreur.donnees?.token;
  const apiL = (chemin, opts = {}) => appel(chemin, { ...opts, jeton: jetonLivreur, tenant: SLUG });
  const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  const SIGN = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  for (const [i, ref] of refs.entries()) {
    if (i >= 22) break;                       // le reste attend l'affectation : le dispatch a de quoi vivre
    const qui = pioche(CHAUFFEURS, i).nom;
    await api(`/v1/orders/${ref}/assign`, { method: 'POST', body: { driver: qui } });
    if (qui !== 'Hamid Ouali') continue;      // seul le livreur connecté peut avancer ses courses
    if (i % 4 === 3) continue;                // quelques-unes restent simplement assignées
    const cmd = (await api(`/v1/orders/${ref}`)).donnees;
    await apiL(`/v1/driver/orders/${ref}/advance`, { method: 'POST' });
    await apiL(`/v1/driver/orders/${ref}/advance`, { method: 'POST' });
    if (i % 3 === 0) continue;                // d'autres restent en cours de retrait
    await apiL(`/v1/driver/orders/${ref}/advance`, { method: 'POST' });
    if (i % 5 === 0) continue;                // et d'autres en cours de livraison
    const niveau = cmd?.proofLevel ?? 'aucune';
    await apiL(`/v1/driver/orders/${ref}/proof`, { method: 'POST', body: {
      codCollected: cmd?.cod ?? 0,
      ...(niveau !== 'aucune' ? { photo: PHOTO } : {}),
      ...(niveau === 'photo_signature' ? { signature: SIGN } : {}),
    } });
  }
  console.log('  courses affectées, en route et livrées — par les routes du produit');
}

console.log(`\nOrganisation de démonstration prête : ${SLUG} · admin@${SLUG}.ma / ${MDP}`);
