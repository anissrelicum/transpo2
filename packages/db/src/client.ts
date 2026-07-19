import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** Drizzle sur les tables globales (schéma platform, référencées de façon qualifiée). */
export const platformDb: NodePgDatabase = drizzle(pool);

/**
 * Exécute `fn` avec le search_path positionné sur le schéma d'un tenant.
 * `schema` est validé en amont (TenantMiddleware) → identifiant sûr ; quote défensive.
 * Isolation stricte : aucune requête ne croise deux schémas de tenants.
 */
export async function withTenantDb<T>(
  schema: string,
  fn: (db: NodePgDatabase, client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}", platform`);
    return await fn(drizzle(client), client);
  } finally {
    client.release();
  }
}
