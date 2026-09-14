// Amorçage du décor de la section G — rejouable, sans aucun secret en dur.
//
// Les runs précédents supposaient une base déjà peuplée « à la main » (OBS-11) : rejoués
// plus tard, les cas échouaient pour des raisons d'outillage. Ce script pose l'état de
// départ attendu par la section G, et consigne les mots de passe temporaires réellement
// émis dans COMPTES.md — c'est là que les cas les relisent, jamais dans leur propre code.
//
// Lancement : node recette/amorcer.mjs   (API_URL / RUN_ID surchargent l'environnement)
import * as fs from 'node:fs';
import * as path from 'node:path';

const API = process.env.API_URL || 'http://localhost:3000';
const TENANT = process.env.TENANT_SLUG || 'rabatexpress';
const SUPER = { email: process.env.SUPER_ADMIN_EMAIL || 'ops@transpo.ma',
                password: process.env.SUPER_ADMIN_PASSWORD || 'transpo' };
export const ADMIN = { email: `admin@${TENANT}.ma`, name: 'Nadia Alaoui' };
export const LIVREUR = { email: `livreur@${TENANT}.ma`, name: 'Hamid Ouali' };
export const CHAUFFEUR = 'Hamid Ouali';
export const CHAUFFEUR_BIS = 'Sara Bennis';

const RUN = process.env.RUN_ID || '2026-09-13-local';
const QA = path.resolve(import.meta.dirname, '../../../qa/recette', RUN);

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
  const texte = await r.text();
  const donnees = texte ? JSON.parse(texte) : null;
  return { ok: r.ok, status: r.status, donnees };
}

/** Une ligne par compte émis, horodatée : les cas y relisent le mot de passe du jour. */
function consigner(email, role, motDePasse) {
  fs.mkdirSync(QA, { recursive: true });
  const fichier = path.join(QA, 'COMPTES.md');
  if (!fs.existsSync(fichier)) {
    fs.writeFileSync(fichier, `# Comptes du run ${RUN}\n\nÉmis par \`recette/amorcer.mjs\`.\n\n`);
  }
  fs.appendFileSync(fichier, `- ${new Date().toISOString()} — ${email} — ${role} — tempPassword=${motDePasse}\n`);
}

export default async function amorcer() {
  const sup = await appel('/v1/auth/super/login', { method: 'POST', body: SUPER });
  if (!sup.ok) throw new Error(`super-admin : connexion refusée (${sup.status})`);
  const jetonSuper = sup.donnees.token;

  // 1. L'organisation. Déjà là (run précédent) → on réamorce son admin plutôt que d'échouer.
  const tenants = (await appel('/v1/saas/tenants', { jeton: jetonSuper })).donnees ?? [];
  let motDePasseAdmin;
  if (!tenants.some((t) => t.slug === TENANT)) {
    const p = await appel('/v1/saas/tenants', {
      method: 'POST', jeton: jetonSuper,
      body: { slug: TENANT, name: 'Rabat Express', city: 'Rabat', planCode: 'transporteur',
              adminEmail: ADMIN.email, adminName: ADMIN.name },
    });
    if (!p.ok) throw new Error(`provisioning refusé (${p.status}) : ${JSON.stringify(p.donnees)}`);
    motDePasseAdmin = p.donnees.admin.tempPassword;
    console.log(`  organisation ${TENANT} provisionnée (plan Transporteur)`);
  } else {
    const r = await appel(`/v1/saas/tenants/${TENANT}/admin`, {
      method: 'POST', jeton: jetonSuper, body: { email: ADMIN.email, name: ADMIN.name },
    });
    if (!r.ok) throw new Error(`réamorçage admin refusé (${r.status})`);
    motDePasseAdmin = r.donnees.tempPassword;
    console.log(`  organisation ${TENANT} déjà là — administrateur réamorcé`);
  }
  consigner(ADMIN.email, 'ADMIN', motDePasseAdmin);

  // 2. Session admin du tenant : tout le reste du décor passe par ses droits.
  const co = await appel('/v1/auth/login', {
    method: 'POST', tenant: TENANT, body: { email: ADMIN.email, password: motDePasseAdmin },
  });
  if (!co.ok) throw new Error(`connexion admin refusée (${co.status})`);
  const jeton = co.donnees.token;
  const tapi = (chemin, opts = {}) => appel(chemin, { ...opts, jeton, tenant: TENANT });

  // 3. La flotte. Le compte livreur exige un chauffeur RÉEL : sans lui, l'invitation est
  //    refusée — c'est le garde-fou posé en section D, on le respecte plutôt que de le
  //    contourner par la base.
  const vehicules = (await tapi('/v1/vehicles')).donnees ?? [];
  if (!vehicules.some((v) => v.plate === '1111-A-11')) {
    await tapi('/v1/vehicles', { method: 'POST', body: {
      plate: '1111-A-11', type: 'Fourgon', city: 'Rabat',
      insuranceDue: `${new Date().getFullYear() + 2}-12-31`,
    } });
  }
  const chauffeurs = (await tapi('/v1/drivers')).donnees ?? [];
  for (const [nom, ville] of [[CHAUFFEUR, 'Rabat'], [CHAUFFEUR_BIS, 'Rabat']]) {
    if (chauffeurs.some((d) => d.name === nom)) continue;
    const r = await tapi('/v1/drivers', { method: 'POST', body: {
      name: nom, city: ville, vehicle: 'Fourgon', phone: '+212600000001',
      licenseNo: 'AB123456', licenseDue: `${new Date().getFullYear() + 3}-06-30`,
      medicalDue: `${new Date().getFullYear() + 2}-06-30`, available: true,
    } });
    if (!r.ok) throw new Error(`chauffeur ${nom} : ${r.status} ${JSON.stringify(r.donnees)}`);
  }
  console.log(`  flotte : ${CHAUFFEUR}, ${CHAUFFEUR_BIS}, véhicule 1111-A-11`);

  // 4. Le compte livreur. Réinvité si absent, mot de passe réinitialisé sinon — dans les
  //    deux cas un mot de passe frais part dans COMPTES.md.
  const utilisateurs = (await tapi('/v1/users')).donnees ?? [];
  const existant = utilisateurs.find((u) => u.email === LIVREUR.email);
  let motDePasseLivreur;
  if (!existant) {
    const r = await tapi('/v1/users', { method: 'POST', body: {
      email: LIVREUR.email, name: LIVREUR.name, role: 'DRIVER', driver: CHAUFFEUR,
    } });
    if (!r.ok) throw new Error(`invitation livreur refusée (${r.status}) : ${JSON.stringify(r.donnees)}`);
    motDePasseLivreur = r.donnees.tempPassword;
  } else {
    const r = await tapi(`/v1/users/${existant.id}/reset-password`, { method: 'POST' });
    if (!r.ok) throw new Error(`réinitialisation livreur refusée (${r.status})`);
    motDePasseLivreur = r.donnees.tempPassword;
  }
  consigner(LIVREUR.email, 'DRIVER', motDePasseLivreur);
  console.log(`  compte livreur ${LIVREUR.email} prêt (mot de passe consigné dans ${RUN}/COMPTES.md)`);

  // 5. Un SECOND tenant, vierge : il sert de témoin au cloisonnement (TC-S02) et aux
  //    états vides (TC-T04). Sans lui, « aucune donnée d'un autre tenant n'est visible »
  //    ne serait vérifié contre rien.
  const temoin = process.env.TENANT_TEMOIN || 'tangerlog';
  const adminTemoin = `admin@${temoin}.ma`;
  let motDePasseTemoin;
  if (!tenants.some((t) => t.slug === temoin)) {
    const p = await appel('/v1/saas/tenants', {
      method: 'POST', jeton: jetonSuper,
      body: { slug: temoin, name: 'Tanger Logistique', city: 'Tanger', planCode: 'tpe-coursier',
              adminEmail: adminTemoin, adminName: 'Omar Tazi' },
    });
    if (!p.ok) throw new Error(`provisioning témoin refusé (${p.status})`);
    motDePasseTemoin = p.donnees.admin.tempPassword;
    console.log(`  organisation témoin ${temoin} provisionnée`);
  } else {
    const r = await appel(`/v1/saas/tenants/${temoin}/admin`, {
      method: 'POST', jeton: jetonSuper, body: { email: adminTemoin, name: 'Omar Tazi' },
    });
    if (!r.ok) throw new Error(`réamorçage admin témoin refusé (${r.status})`);
    motDePasseTemoin = r.donnees.tempPassword;
    console.log(`  organisation témoin ${temoin} déjà là — administrateur réamorcé`);
  }
  consigner(adminTemoin, 'ADMIN', motDePasseTemoin);

  return { tenant: TENANT, admin: { ...ADMIN, motDePasse: motDePasseAdmin },
           livreur: { ...LIVREUR, motDePasse: motDePasseLivreur },
           temoin: { slug: temoin, email: adminTemoin, motDePasse: motDePasseTemoin } };
}

if (import.meta.filename === process.argv[1]) {
  amorcer().then(() => console.log('Décor de la section G en place.'),
    (e) => { console.error(`Amorçage impossible — ${e.message}`); process.exit(1); });
}
