// Seed de dev : provisionne 2 tenants de démo + leurs commandes.
// Remplace l'ancien seeding SQL brut (init.sql). Lancement : pnpm --filter @transpo/db seed.
import { pool } from './client.js';
import { provisionTenant, schemaFor, type TenantInput } from './provision.js';

const DEMO_TENANTS: TenantInput[] = [
  { slug: 'casaexpress', name: 'CasaExpress', city: 'Casablanca', plan: 'Transporteur', status: 'ACTIF' },
  { slug: 'atlas', name: 'Atlas Courier', city: 'Marrakech', plan: 'TPE Coursier', status: 'ACTIF' },
];

type OrderRow = [string, string, string, string, string, string, string | null, number, boolean, string];

const ORDERS: Record<string, OrderRow[]> = {
  casaexpress: [
    ['CMD-20260712-014', 'A7K2M9QX', 'LIVRAISON', 'Boutique Zellige', 'Casablanca', 'Casablanca', 'Youssef Benali', 1250, false, 'Moyen'],
    ['CMD-20260712-013', 'B3P8K1LM', 'NOUVELLE', 'Atlas Cosmetics', 'Rabat', 'Salé', null, 480, false, 'Petit'],
  ],
  atlas: [
    ['CMD-20260712-900', 'Z9Q1M4KP', 'RECUPEREE', 'Riad Déco', 'Marrakech', 'Marrakech', 'Karim El Amrani', 0, false, 'Grand'],
  ],
};

async function main() {
  const client = await pool.connect();
  try {
    for (const t of DEMO_TENANTS) {
      await provisionTenant(client, t);
      await client.query(`SET search_path TO "${schemaFor(t.slug)}", platform`);
      for (const o of ORDERS[t.slug] ?? []) {
        await client.query(
          `INSERT INTO orders (ref, code, status, merchant, from_city, to_city, driver, cod, cod_paid, size)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (ref) DO NOTHING`,
          o,
        );
      }
    }
    // eslint-disable-next-line no-console
    console.log(`Seed OK — ${DEMO_TENANTS.length} tenants.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
