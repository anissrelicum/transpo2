import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const TENANT_MIGRATIONS = join(here, '..', 'migrations', 'tenant');

export function schemaFor(slug: string): string {
  return `tenant_${slug}`;
}

function sqlFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
}

/** Crée le schéma du tenant (s'il manque) et applique ses migrations. Idempotent. */
export async function applyTenantMigrations(client: pg.PoolClient, schema: string): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await client.query(`SET search_path TO "${schema}", platform`);
  for (const f of sqlFiles(TENANT_MIGRATIONS)) {
    await client.query(readFileSync(join(TENANT_MIGRATIONS, f), 'utf8'));
  }
}

export interface TenantInput {
  slug: string;
  name: string;
  city?: string;
  plan?: string;
  status?: string;
}

/**
 * Provisionne un tenant : crée son schéma + tables, puis l'enregistre dans platform.tenants.
 * C'est l'opération appelée par « Provisionner un tenant » (Console SaaS, tranche T18).
 */
export async function provisionTenant(client: pg.PoolClient, t: TenantInput): Promise<void> {
  await applyTenantMigrations(client, schemaFor(t.slug));
  await client.query('SET search_path TO platform');
  await client.query(
    `INSERT INTO platform.tenants (slug, name, city, plan, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slug) DO NOTHING`,
    [t.slug, t.name, t.city ?? null, t.plan ?? 'Essai', t.status ?? 'ESSAI'],
  );
}
