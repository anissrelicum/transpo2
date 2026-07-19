// Runner de migrations schema-per-tenant : platform d'abord, puis chaque tenant existant.
// Idempotent (CREATE ... IF NOT EXISTS). Un vrai suivi de versions viendra plus tard.
// Lancement : pnpm --filter @transpo/db migrate  (toujours en conteneur, cf. transpo-architecture).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './client.js';
import { applyTenantMigrations, schemaFor } from './provision.js';

const here = dirname(fileURLToPath(import.meta.url));
const PLATFORM_MIGRATIONS = join(here, '..', 'migrations', 'platform');

async function main() {
  const client = await pool.connect();
  try {
    // 1) Migrations globales (platform)
    const files = readdirSync(PLATFORM_MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      await client.query(readFileSync(join(PLATFORM_MIGRATIONS, f), 'utf8'));
    }
    // 2) Migrations de chaque tenant déjà enregistré
    const { rows } = await client.query<{ slug: string }>('SELECT slug FROM platform.tenants');
    for (const r of rows) {
      await applyTenantMigrations(client, schemaFor(r.slug));
    }
    // eslint-disable-next-line no-console
    console.log(`Migrations OK — platform + ${rows.length} tenant(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
