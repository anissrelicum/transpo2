// Crée un compte de connexion dans un tenant existant.
// Comble un trou fonctionnel : la console ne sait pas créer le PREMIER admin d'un
// tenant fraîchement provisionné, ni aucun compte MERCHANT ou DRIVER.
//
// Lancement :
//   pnpm --filter @transpo/db account <slug> <email> "<Nom>" <ROLE> <motdepasse> ["<scope>"]
//
//   <ROLE>  = ADMIN | DISPATCHER | COMPTABLE | MERCHANT | DRIVER
//   <scope> = nom du marchand (rôle MERCHANT) ou nom du chauffeur (rôle DRIVER),
//             tel qu'il apparaît dans les commandes / la fiche chauffeur.
import { pool } from './client.js';
import { schemaFor } from './provision.js';
import { hashPassword } from './crypto.js';

const ROLES = ['ADMIN', 'DISPATCHER', 'COMPTABLE', 'MERCHANT', 'DRIVER'];

async function main(): Promise<void> {
  // `pnpm account -- <args>` transmet le `--` littéralement selon les versions : on l'ignore.
  const argv = process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--'));
  const [slug, email, name, role, password, scope] = argv;
  if (!slug || !email || !name || !role || !password) {
    throw new Error('Usage : <slug> <email> "<Nom>" <ROLE> <motdepasse> ["<scope>"]');
  }
  if (!ROLES.includes(role)) throw new Error(`Rôle inconnu : ${role} (attendu : ${ROLES.join(', ')})`);
  if (role === 'MERCHANT' && !scope) throw new Error('Rôle MERCHANT : le nom du marchand est requis en 6e argument.');
  if (role === 'DRIVER' && !scope) throw new Error('Rôle DRIVER : le nom du chauffeur est requis en 6e argument.');

  const { rowCount } = await pool.query('SELECT 1 FROM platform.tenants WHERE slug = $1', [slug]);
  if (!rowCount) throw new Error(`Tenant inconnu : ${slug} — provisionnez-le d'abord depuis la console plateforme.`);

  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaFor(slug)}", platform`);
    const hash = await hashPassword(password);
    await client.query(
      `INSERT INTO users (email, password_hash, name, role, merchant, driver)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name,
             role = EXCLUDED.role, merchant = EXCLUDED.merchant, driver = EXCLUDED.driver,
             active = TRUE`,
      [
        email.toLowerCase(),
        hash,
        name,
        role,
        role === 'MERCHANT' ? scope : null,
        role === 'DRIVER' ? scope : null,
      ],
    );
    // eslint-disable-next-line no-console
    console.log(`Compte OK — ${email} (${role}) sur le tenant ${slug}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
