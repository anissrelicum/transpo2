// Seed de dev : provisionne 2 tenants de démo + leurs commandes.
// Remplace l'ancien seeding SQL brut (init.sql). Lancement : pnpm --filter @transpo/db seed.
import { pool } from './client.js';
import { provisionTenant, schemaFor, type TenantInput } from './provision.js';
import { hashPassword } from './crypto.js';

// Utilisateurs de démo par tenant (mot de passe commun en dev : "transpo").
const USERS: Record<string, Array<{ email: string; name: string; role: string }>> = {
  casaexpress: [
    { email: 'admin@casaexpress.ma', name: 'Youssef Benali', role: 'ADMIN' },
    { email: 'dispatch@casaexpress.ma', name: 'Salma Idrissi', role: 'DISPATCHER' },
    { email: 'compta@casaexpress.ma', name: 'Fatima Zahra', role: 'COMPTABLE' },
  ],
  atlas: [
    { email: 'admin@atlas.ma', name: 'Karim El Amrani', role: 'ADMIN' },
  ],
  // Tenant dédié aux tests E2E mutants (création/annulation…) : n'affecte pas casaexpress/atlas.
  e2e: [
    { email: 'admin@e2e.ma', name: 'E2E Admin', role: 'ADMIN' },
    { email: 'compta@e2e.ma', name: 'E2E Compta', role: 'COMPTABLE' },
  ],
};
const DEV_PASSWORD = 'transpo';

const DEMO_TENANTS: TenantInput[] = [
  { slug: 'casaexpress', name: 'CasaExpress', city: 'Casablanca', plan: 'Transporteur', status: 'ACTIF' },
  { slug: 'atlas', name: 'Atlas Courier', city: 'Marrakech', plan: 'TPE Coursier', status: 'ACTIF' },
  { slug: 'e2e', name: 'E2E Test', city: 'Casablanca', plan: 'Transporteur', status: 'ACTIF' },
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

const DRIVERS: Record<string, Array<{ name: string; city: string; vehicle: string; available: boolean }>> = {
  casaexpress: [
    { name: 'Youssef Benali', city: 'Casablanca', vehicle: 'Moto', available: true },
    { name: 'Salma Idrissi', city: 'Rabat', vehicle: 'Fourgon', available: true },
  ],
  atlas: [
    { name: 'Karim El Amrani', city: 'Marrakech', vehicle: 'Voiture', available: false },
  ],
  e2e: [
    { name: 'Youssef Benali', city: 'Casablanca', vehicle: 'Moto', available: true },
    { name: 'Salma Idrissi', city: 'Rabat', vehicle: 'Fourgon', available: true },
  ],
};

const ZONES: Record<string, Array<{ fr: string; ar: string; color: string; commune: string; drivers: string[] }>> = {
  casaexpress: [
    { fr: 'Casa Centre', ar: 'الدار البيضاء الوسط', color: 'indigo', commune: 'Maârif', drivers: ['YB', 'SI'] },
    { fr: 'Casa Nord', ar: 'الدار البيضاء الشمال', color: 'cyan', commune: 'Aïn Sebaâ', drivers: [] },
  ],
};

// Véhicules — l'un a une assurance expirée (règle de conformité, cf. transpo-domain).
const VEHICLES: Record<string, Array<{ plate: string; type: string; city: string; state: string; ins: string; ct: string }>> = {
  casaexpress: [
    { plate: '1234-A-56', type: 'Fourgon', city: 'Casablanca', state: 'ACTIF', ins: '2026-07-10', ct: '2027-03-01' }, // assurance expirée
    { plate: '7890-B-12', type: 'Moto', city: 'Rabat', state: 'ACTIF', ins: '2026-11-01', ct: '2026-08-01' },
  ],
};

async function main() {
  const client = await pool.connect();
  try {
    const devHash = await hashPassword(DEV_PASSWORD);

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
      for (const u of USERS[t.slug] ?? []) {
        await client.query(
          `INSERT INTO users (email, password_hash, name, role)
           VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
          [u.email, devHash, u.name, u.role],
        );
      }
      for (const d of DRIVERS[t.slug] ?? []) {
        await client.query(
          `INSERT INTO drivers (name, city, vehicle, available)
           SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM drivers WHERE name = $1)`,
          [d.name, d.city, d.vehicle, d.available],
        );
      }
      for (const z of ZONES[t.slug] ?? []) {
        await client.query(
          `INSERT INTO zones (name_fr, name_ar, color, commune, drivers)
           SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (SELECT 1 FROM zones WHERE name_fr = $1)`,
          [z.fr, z.ar, z.color, z.commune, z.drivers],
        );
      }
      for (const v of VEHICLES[t.slug] ?? []) {
        await client.query(
          `INSERT INTO vehicles (plate, type, city, state, insurance_due, ct_due)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (plate) DO NOTHING`,
          [v.plate, v.type, v.city, v.state, v.ins, v.ct],
        );
      }
    }

    // Super-admin plateforme (realm séparé)
    await client.query('SET search_path TO platform');
    await client.query(
      `INSERT INTO platform.super_admins (email, password_hash, name)
       VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`,
      ['ops@transpo.ma', devHash, 'Ops Transpo'],
    );

    // eslint-disable-next-line no-console
    console.log(`Seed OK — ${DEMO_TENANTS.length} tenants + users + super-admin (mdp dev: "${DEV_PASSWORD}").`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
