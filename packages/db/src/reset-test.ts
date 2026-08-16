// Remise à zéro de l'environnement de test manuel.
// Supprime TOUS les tenants (schémas + lignes platform.tenants) et le journal
// d'audit ; ne conserve que les super-admins plateforme (platform.super_admins).
// Lancement : pnpm --filter @transpo/db reset-test
// Sécurité : refuse de tourner si RESET_CONFIRM !== 'oui' (garde-fou anti-prod).
import { pool } from './client.js';
import { hashPassword } from './crypto.js';

const SUPER_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'ops@transpo.ma';
const SUPER_NAME = process.env.SUPER_ADMIN_NAME || 'Ops Transpo';
const SUPER_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'transpo';

async function main(): Promise<void> {
  if (process.env.RESET_CONFIRM !== 'oui') {
    throw new Error('Refus : relancez avec RESET_CONFIRM=oui (efface toutes les données tenant).');
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ nspname: string }>(
      `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\\_%'`,
    );
    for (const r of rows) {
      await client.query(`DROP SCHEMA IF EXISTS "${r.nspname}" CASCADE`);
    }
    await client.query('DELETE FROM platform.audit_log');
    await client.query('DELETE FROM platform.tenants');

    // Garantit qu'au moins un super-admin reste utilisable après le vidage.
    const hash = await hashPassword(SUPER_PASSWORD);
    await client.query(
      `INSERT INTO platform.super_admins (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
      [SUPER_EMAIL, hash, SUPER_NAME],
    );

    // eslint-disable-next-line no-console
    console.log(
      `Reset OK — ${rows.length} schéma(s) tenant supprimé(s). ` +
        `Super-admin conservé : ${SUPER_EMAIL} (mdp: "${SUPER_PASSWORD}").`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
