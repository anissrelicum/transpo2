import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Exécute `fn` avec le search_path positionné sur le schéma du tenant.
 * `schema` est validé en amont par le TenantMiddleware (identifiant sûr) ;
 * on le quote défensivement. Isolation stricte : aucune requête ne croise deux schémas.
 */
export async function withTenant<T>(
  schema: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}", platform`);
    return await fn(client);
  } finally {
    client.release();
  }
}
