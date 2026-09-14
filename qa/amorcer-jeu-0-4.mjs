// Jeu de données §0.4 du plan de recette — le point de départ que TOUTES les sections
// supposent acquis : l'organisation de travail `rabatexpress` (abonnement Entreprise actif,
// administrateur `admin@rabatexpress.ma` / Test1234) et l'organisation témoin `tangerlog`
// (laissée en essai).
//
// Pourquoi ce script existe : `rejouer-tout.sh` annonçait « tout, depuis une base vierge »
// alors que `reset-test` supprime ces deux organisations et que AUCUN cas ne les recrée.
// Les runs locaux passaient parce que la base traînait un `rabatexpress` d'une session
// antérieure ; sur le homelab remis à zéro le 14/09, six cas de la section A, quinze de la
// section B et les quarante-six cas C→F sont tombés sur ce seul manque.
//
// Lancement : node qa/amorcer-jeu-0-4.mjs   (API_URL / RUN_ID / ACCOUNT_EXEC surchargent)
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const API = process.env.API_URL || 'http://localhost:3000';
const RUN = process.env.RUN_ID || `${new Date().toISOString().slice(0, 10)}-local`;
const QA = path.resolve(import.meta.dirname, 'recette', RUN);
const SUPER = { email: process.env.SUPER_ADMIN_EMAIL || 'ops@transpo.ma',
                password: process.env.SUPER_ADMIN_PASSWORD || 'transpo' };

// Le mot de passe de travail est cité en clair par TC-A28, TC-A29 et TC-B02 : il fait
// partie du jeu de données, ce n'est pas un secret d'exploitation.
const MDP_ADMIN = 'Test1234';

const ORGS = [
  { slug: 'rabatexpress', name: 'Rabat Express', city: 'Rabat', admin: 'Nadia Alaoui',
    plan: 'transporteur', entreprise: true },
  { slug: 'tangerlog', name: 'Tanger Logistique', city: 'Tanger', admin: 'Omar Tazi',
    plan: 'tpe-coursier', entreprise: false },
];

async function appel(chemin, { method = 'GET', body, jeton } = {}) {
  const r = await fetch(`${API}${chemin}`, {
    method,
    headers: { 'content-type': 'application/json', ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texte = await r.text();
  return { ok: r.ok, status: r.status, donnees: texte ? JSON.parse(texte) : null };
}

/** Pose un compte par le même CLI que TC-B02, quel que soit l'environnement. */
function compteCli(tenant, email, nom, role, motDePasse) {
  const args = `${tenant} ${email} '${nom}' ${role} ${motDePasse}`;
  // Sur le homelab le CLI tourne DANS le pod : les arguments doivent entrer dans le
  // `sh -c "…"`, pas être collés après. D'où le jeton %ARGS%, obligatoire dès que la
  // commande enveloppe le CLI (les coller en queue perdait tous les arguments).
  const base = process.env.ACCOUNT_EXEC || 'pnpm --filter @transpo/db account';
  const cmd = base.includes('%ARGS%') ? base.replace('%ARGS%', args) : `${base} ${args}`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function consigner(email, role, motDePasse) {
  fs.mkdirSync(QA, { recursive: true });
  const fichier = path.join(QA, 'COMPTES.md');
  if (!fs.existsSync(fichier)) fs.writeFileSync(fichier, `# Comptes du run ${RUN}\n\n`);
  fs.appendFileSync(fichier, `- ${new Date().toISOString()} — ${email} — ${role} — tempPassword=${motDePasse}\n`);
}

const sup = await appel('/v1/auth/super/login', { method: 'POST', body: SUPER });
if (!sup.ok) throw new Error(`super-admin : connexion refusée (${sup.status})`);
const jeton = sup.donnees.token;

const parc = (await appel('/v1/saas/tenants', { jeton })).donnees ?? [];
for (const org of ORGS) {
  if (!parc.some((t) => t.slug === org.slug)) {
    const p = await appel('/v1/saas/tenants', {
      method: 'POST', jeton,
      body: { slug: org.slug, name: org.name, city: org.city, planCode: org.plan,
              adminEmail: `admin@${org.slug}.ma`, adminName: org.admin },
    });
    if (!p.ok) throw new Error(`provisioning ${org.slug} refusé (${p.status}) : ${JSON.stringify(p.donnees)}`);
    console.log(`  ${org.slug} provisionnée (essai, plan Transporteur)`);
  } else {
    console.log(`  ${org.slug} déjà au parc`);
  }

  // TC-A09 et TC-A18 partent d'un `rabatexpress` abonné Entreprise, pas d'un essai :
  // la conversion fait partie du jeu de départ, elle n'est jouée par aucun cas.
  if (org.entreprise) {
    const abo = (await appel(`/v1/saas/tenants/${org.slug}/subscription`, { jeton })).donnees;
    if (abo?.status !== 'ACTIF' || abo?.planCode !== 'entreprise') {
      const c = await appel(`/v1/saas/tenants/${org.slug}/subscription`, {
        method: 'POST', jeton, body: { planCode: 'entreprise', immediate: true },
      });
      if (!c.ok) throw new Error(`conversion ${org.slug} refusée (${c.status}) : ${JSON.stringify(c.donnees)}`);
      console.log(`  ${org.slug} → abonnement Entreprise actif`);
    }
  }
}

// L'administrateur de travail porte un mot de passe CITÉ par les cas : il est posé ici,
// pas tiré au sort, et consigné pour `motDePasse()` qui sert aux sections C à T.
const sortie = compteCli('rabatexpress', 'admin@rabatexpress.ma', 'Nadia Alaoui', 'ADMIN', MDP_ADMIN);
console.log(`  ${sortie}`);
consigner('admin@rabatexpress.ma', 'ADMIN', MDP_ADMIN);
console.log('Jeu §0.4 en place.');
