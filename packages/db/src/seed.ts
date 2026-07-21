// Seed de dev : provisionne 2 tenants de démo + leurs commandes.
// Remplace l'ancien seeding SQL brut (init.sql). Lancement : pnpm --filter @transpo/db seed.
import { pool } from './client.js';
import { provisionTenant, schemaFor, type TenantInput } from './provision.js';
import { hashPassword } from './crypto.js';
import { fraudScore, type FraudSignal } from '@transpo/domain';

// Utilisateurs de démo par tenant (mot de passe commun en dev : "transpo").
const USERS: Record<string, Array<{ email: string; name: string; role: string; merchant?: string; driver?: string }>> = {
  casaexpress: [
    { email: 'admin@casaexpress.ma', name: 'Youssef Benali', role: 'ADMIN' },
    { email: 'dispatch@casaexpress.ma', name: 'Salma Idrissi', role: 'DISPATCHER' },
    { email: 'compta@casaexpress.ma', name: 'Fatima Zahra', role: 'COMPTABLE' },
    { email: 'marchand@casaexpress.ma', name: 'Boutique Zellige', role: 'MERCHANT', merchant: 'Boutique Zellige' },
    { email: 'livreur@casaexpress.ma', name: 'Youssef Benali', role: 'DRIVER', driver: 'Youssef Benali' },
  ],
  atlas: [
    { email: 'admin@atlas.ma', name: 'Karim El Amrani', role: 'ADMIN' },
  ],
  // Tenant dédié aux tests E2E mutants (création/annulation…) : n'affecte pas casaexpress/atlas.
  e2e: [
    { email: 'admin@e2e.ma', name: 'E2E Admin', role: 'ADMIN' },
    { email: 'compta@e2e.ma', name: 'E2E Compta', role: 'COMPTABLE' },
    { email: 'marchand@e2e.ma', name: 'Marchand E2E', role: 'MERCHANT', merchant: 'Marchand E2E' },
    { email: 'livreur@e2e.ma', name: 'Youssef Benali', role: 'DRIVER', driver: 'Youssef Benali' },
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
    // Arrêts multi-villes d'une tournée de démo (Youssef Benali).
    ['CMD-20260712-201', 'T1R2A3B4', 'ASSIGNEE', 'Boutique Zellige', 'Casablanca', 'Rabat', 'Youssef Benali', 640, false, 'Moyen'],
    ['CMD-20260712-202', 'T2M3O4H5', 'ASSIGNEE', 'Atlas Cosmetics', 'Casablanca', 'Mohammedia', 'Youssef Benali', 0, false, 'Petit'],
    ['CMD-20260712-203', 'T3K4E5N6', 'ASSIGNEE', 'Souss Électro', 'Casablanca', 'Kénitra', 'Youssef Benali', 1500, false, 'Grand'],
    // Commandes échouées (gestion des retours).
    ['CMD-20260711-142', 'G1M9K4PX', 'ECHOUEE', 'Atlas Cosmetics', 'Rabat', 'Kénitra', 'Salma Idrissi', 900, false, 'Moyen'],
    ['CMD-20260711-138', 'H4P7M2KQ', 'ECHOUEE', 'Souss Électro', 'Casablanca', 'Tanger', 'Nadia Chraibi', 1500, false, 'Grand'],
    // Colis dans le hub (tri) — destinations variées.
    ['CMD-20260714-301', 'HM4K7P2X', 'RECUPEREE', 'Boutique Zellige', 'Casablanca', 'Marrakech', 'Youssef Benali', 640, false, 'Moyen'],
    ['CMD-20260714-302', 'HR8P3K1M', 'RECUPEREE', 'Atlas Cosmetics', 'Casablanca', 'Rabat', 'Youssef Benali', 0, false, 'Petit'],
    ['CMD-20260714-303', 'HT2M9X4K', 'RECUPEREE', 'Souss Électro', 'Casablanca', 'Tanger', 'Nadia Chraibi', 1500, false, 'Grand'],
    ['CMD-20260714-304', 'HM8K3P2Q', 'RECUPEREE', 'Riad Déco', 'Casablanca', 'Marrakech', 'Nadia Chraibi', 3200, false, 'Très grand'],
  ],
  atlas: [
    ['CMD-20260712-900', 'Z9Q1M4KP', 'RECUPEREE', 'Riad Déco', 'Marrakech', 'Marrakech', 'Karim El Amrani', 0, false, 'Grand'],
  ],
  // Commande livrée stable (suivi public + notation) — code fixe pour les tests E2E.
  e2e: [
    ['CMD-E2E-TRACK', 'TRACK123', 'LIVREE', 'Marchand E2E', 'Casablanca', 'Rabat', 'Youssef Benali', 500, true, 'Moyen'],
  ],
};

const DRIVERS: Record<string, Array<{ name: string; city: string; vehicle: string; available: boolean }>> = {
  casaexpress: [
    { name: 'Youssef Benali', city: 'Casablanca', vehicle: 'Moto', available: true },
    { name: 'Salma Idrissi', city: 'Rabat', vehicle: 'Fourgon', available: true },
    { name: 'Nadia Chraibi', city: 'Casablanca', vehicle: 'Moto', available: true },
    { name: 'Omar Fassi', city: 'Casablanca', vehicle: 'Fourgon', available: true },
  ],
  atlas: [
    { name: 'Karim El Amrani', city: 'Marrakech', vehicle: 'Voiture', available: false },
  ],
  e2e: [
    { name: 'Youssef Benali', city: 'Casablanca', vehicle: 'Moto', available: true },
    { name: 'Salma Idrissi', city: 'Rabat', vehicle: 'Fourgon', available: true },
  ],
};

// Polygone carré ~4 km autour d'un centre.
function box(lat: number, lng: number): number[][] {
  const d = 0.02;
  return [[lat + d, lng - d], [lat + d, lng + d], [lat - d, lng + d], [lat - d, lng - d]];
}
const ZONES: Record<string, Array<{ fr: string; ar: string; color: string; commune: string; region: string; province: string; drivers: string[]; lat: number; lng: number }>> = {
  casaexpress: [
    { fr: 'Casa Centre', ar: 'الدار البيضاء الوسط', color: 'indigo', commune: 'Maârif', region: 'Casablanca-Settat', province: 'Casablanca', drivers: ['YB', 'SI'], lat: 33.5850, lng: -7.6330 },
    { fr: 'Casa Nord', ar: 'الدار البيضاء الشمال', color: 'cyan', commune: 'Aïn Sebaâ', region: 'Casablanca-Settat', province: 'Casablanca', drivers: [], lat: 33.6050, lng: -7.5300 },
  ],
};

// Retours (livraisons échouées à arbitrer).
const RETURNS: Record<string, Array<{ ref: string; reason: string; attempts: number; status: string }>> = {
  casaexpress: [
    { ref: 'CMD-20260711-142', reason: 'Client absent', attempts: 2, status: 'A_TRAITER' },
    { ref: 'CMD-20260711-138', reason: 'Client refuse le colis', attempts: 1, status: 'A_TRAITER' },
  ],
};
// Phase de tri dans le hub par code colis (arrive / trier / quai).
const HUB_PHASE: Record<string, Record<string, string>> = {
  casaexpress: { 'HM4K7P2X': 'arrive', 'HR8P3K1M': 'trier', 'HT2M9X4K': 'quai', 'HM8K3P2Q': 'quai' },
};

// Tournée de démo (planificateur multi-arrêts) — arrêts multi-villes.
const TOURNEES: Record<string, Array<{ driver: string; zone: string; day: string; stops: string[] }>> = {
  casaexpress: [
    { driver: 'Youssef Benali', zone: 'Casa Centre', day: '2026-07-14', stops: ['CMD-20260712-201', 'CMD-20260712-202', 'CMD-20260712-203'] },
  ],
};

// Géofences par livreur (PC flotte). Chaque livreur a une zone assignée (centre + rayon).
const GEOFENCES: Record<string, Array<{ driver: string; name: string; lat: number; lng: number; radius: number }>> = {
  casaexpress: [
    { driver: 'Youssef Benali', name: 'Casa Centre', lat: 33.5850, lng: -7.6330, radius: 5000 },
    { driver: 'Salma Idrissi', name: 'Casa Nord', lat: 33.6050, lng: -7.5300, radius: 5000 },
    { driver: 'Nadia Chraibi', name: 'Casa Sud', lat: 33.5490, lng: -7.6160, radius: 5000 },
    { driver: 'Omar Fassi', name: 'Casa Centre', lat: 33.5850, lng: -7.6330, radius: 5000 },
  ],
};
// Dernière position connue de chaque livreur (PC flotte temps réel). Omar est loin de sa zone → alerte.
const POSITIONS: Record<string, Array<{ driver: string; lat: number; lng: number }>> = {
  casaexpress: [
    { driver: 'Youssef Benali', lat: 33.5840, lng: -7.6120 },
    { driver: 'Salma Idrissi', lat: 33.6040, lng: -7.5400 },
    { driver: 'Nadia Chraibi', lat: 33.5510, lng: -7.6110 },
    { driver: 'Omar Fassi', lat: 33.6600, lng: -7.4500 }, // hors zone
  ],
};

// Véhicules — l'un a une assurance expirée (règle de conformité, cf. transpo-domain).
const VEHICLES: Record<string, Array<{ plate: string; type: string; city: string; state: string; ins: string; ct: string }>> = {
  casaexpress: [
    { plate: '1234-A-56', type: 'Fourgon', city: 'Casablanca', state: 'ACTIF', ins: '2026-07-10', ct: '2027-03-01' }, // assurance expirée
    { plate: '7890-B-12', type: 'Moto', city: 'Rabat', state: 'ACTIF', ins: '2026-11-01', ct: '2026-08-01' },
  ],
};

// Cas de fraude COD (revue humaine requise). Score recalculé au seed via fraudScore.
const FRAUD: Record<string, Array<{ driver: string; amount: number; signals: string[]; status: string; summary: string }>> = {
  casaexpress: [
    { driver: 'Karim El Amrani', amount: 3200, signals: ['non_declare', 'ecart_cash', 'depot_tardif'], status: 'OUVERT', summary: 'COD de 3 200 DH marqué livré, absent du dépôt de caisse. Écart de 200 DH la veille.' },
    { driver: 'Nadia Chraibi', amount: 1500, signals: ['hors_geo', 'echec_sans_preuve'], status: 'ENQUETE', summary: 'Livraison validée à 1,8 km de l’adresse client, sans photo alors que preuve exigée.' },
    { driver: 'Karim El Amrani', amount: 0, signals: ['absent_eleve'], status: 'OUVERT', summary: 'Taux « client absent » de 31 % sur 7 jours (moyenne flotte : 9 %).' },
    { driver: 'Omar Fassi', amount: 260, signals: ['depot_tardif'], status: 'BLANCHI', summary: 'Dépôt tardif justifié : panne véhicule confirmée par le dispatcher.' },
  ],
  e2e: [
    { driver: 'Youssef Benali', amount: 1500, signals: ['hors_geo', 'echec_sans_preuve'], status: 'OUVERT', summary: 'Validation à 1,8 km de l’adresse, sans photo.' },
  ],
};

// Sessions de caisse (réconciliation COD par livreur, 14/07/2026).
type CashMoveSeed = { ref: string; recipient: string; amount: number; matched: boolean };
type CashSeed = {
  driver: string; ini: string; date: string; theorique: number; declared: number | null;
  deposited: number; deliveries: number; cap: number; status: string; moves?: CashMoveSeed[];
};
const CASH: Record<string, CashSeed[]> = {
  casaexpress: [
    { driver: 'Youssef Benali', ini: 'YB', date: '2026-07-14', theorique: 5140, declared: 5140, deposited: 5140, deliveries: 7, cap: 8000, status: 'DEPOSE' },
    { driver: 'Salma Idrissi', ini: 'SI', date: '2026-07-14', theorique: 3820, declared: 3820, deposited: 0, deliveries: 5, cap: 6000, status: 'A_DEPOSER' },
    { driver: 'Karim El Amrani', ini: 'KE', date: '2026-07-14', theorique: 4600, declared: 4400, deposited: 0, deliveries: 6, cap: 5000, status: 'ECART', moves: [
      { ref: 'CMD-20260714-088', recipient: 'Salma Idrissi', amount: 1250, matched: true },
      { ref: 'CMD-20260714-091', recipient: 'Mehdi Tahiri', amount: 680, matched: true },
      { ref: 'CMD-20260714-095', recipient: 'Imane Ouazzani', amount: 900, matched: true },
      { ref: 'CMD-20260714-097', recipient: 'Yassine Bennani', amount: 1000, matched: true },
      { ref: 'CMD-20260714-099', recipient: 'Fatima Zahra', amount: 770, matched: false },
    ] },
    { driver: 'Nadia Chraibi', ini: 'NC', date: '2026-07-14', theorique: 2260, declared: 2260, deposited: 2260, deliveries: 4, cap: 6000, status: 'DEPOSE' },
    { driver: 'Omar Fassi', ini: 'OF', date: '2026-07-14', theorique: 6980, declared: null, deposited: 0, deliveries: 9, cap: 7000, status: 'EN_COURS' },
  ],
  e2e: [
    { driver: 'Youssef Benali', ini: 'YB', date: '2026-07-14', theorique: 1500, declared: 1500, deposited: 0, deliveries: 2, cap: 6000, status: 'A_DEPOSER' },
  ],
};

// Factures marchand (service de livraison : commission 15 % + TVA 20 %).
type InvoiceSeed = {
  ref: string; merchant: string; period: string; orders: number; deliveries: number;
  cod: number; commission: number; net: number; tva: number; status: string;
  disputeAmount?: number; disputeNote?: string;
};
const INVOICES: Record<string, InvoiceSeed[]> = {
  casaexpress: [
    { ref: 'FCT-2026-07-0042', merchant: 'Boutique Zellige', period: '2026-07', orders: 128, deliveries: 8420, cod: 42300, commission: 1263, net: 7157, tva: 1431, status: 'BROUILLON' },
    { ref: 'FCT-2026-07-0041', merchant: 'Atlas Cosmetics', period: '2026-07', orders: 76, deliveries: 4980, cod: 18600, commission: 747, net: 4233, tva: 847, status: 'ENVOYEE' },
    { ref: 'FCT-2026-06-0039', merchant: 'Riad Déco', period: '2026-06', orders: 54, deliveries: 3820, cod: 9400, commission: 573, net: 3247, tva: 649, status: 'PAYEE' },
    { ref: 'FCT-2026-06-0038', merchant: 'Souss Électro', period: '2026-06', orders: 41, deliveries: 5210, cod: 31200, commission: 782, net: 4428, tva: 886, status: 'LITIGE', disputeAmount: 1200, disputeNote: 'Écart de reversement COD contesté sur 3 commandes.' },
  ],
  e2e: [
    { ref: 'FCT-2026-07-0001', merchant: 'Marchand E2E', period: '2026-07', orders: 12, deliveries: 900, cod: 3000, commission: 135, net: 765, tva: 153, status: 'BROUILLON' },
  ],
};
const BILLING_MODES: Record<string, Array<{ merchant: string; mode: string }>> = {
  casaexpress: [
    { merchant: 'Boutique Zellige', mode: 'prepaid' },
    { merchant: 'Atlas Cosmetics', mode: 'postpaid' },
    { merchant: 'Riad Déco', mode: 'prepaid' },
    { merchant: 'Souss Électro', mode: 'postpaid' },
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
          `INSERT INTO users (email, password_hash, name, role, merchant, driver)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
          [u.email, devHash, u.name, u.role, u.merchant ?? null, u.driver ?? null],
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
          `INSERT INTO zones (name_fr, name_ar, color, commune, region, province, drivers, center_lat, center_lng, polygon)
           SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 WHERE NOT EXISTS (SELECT 1 FROM zones WHERE name_fr = $1)`,
          [z.fr, z.ar, z.color, z.commune, z.region, z.province, z.drivers, z.lat, z.lng, JSON.stringify(box(z.lat, z.lng))],
        );
      }
      for (const v of VEHICLES[t.slug] ?? []) {
        await client.query(
          `INSERT INTO vehicles (plate, type, city, state, insurance_due, ct_due)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (plate) DO NOTHING`,
          [v.plate, v.type, v.city, v.state, v.ins, v.ct],
        );
      }
      for (const f of FRAUD[t.slug] ?? []) {
        const score = fraudScore(f.signals as FraudSignal[]);
        await client.query(
          `INSERT INTO fraud_cases (driver, amount, signals, score, status, summary)
           SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM fraud_cases WHERE driver = $1 AND summary = $6)`,
          [f.driver, f.amount, f.signals, score, f.status, f.summary],
        );
      }
      for (const rt of RETURNS[t.slug] ?? []) {
        await client.query(
          `INSERT INTO returns (ref, reason, attempts, status)
           SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM returns WHERE ref = $1)`,
          [rt.ref, rt.reason, rt.attempts, rt.status],
        );
      }
      for (const [code, phase] of Object.entries(HUB_PHASE[t.slug] ?? {})) {
        await client.query('UPDATE orders SET hub_phase = $2 WHERE code = $1 AND hub_phase IS NULL', [code, phase]);
      }
      for (const tr of TOURNEES[t.slug] ?? []) {
        await client.query(
          `INSERT INTO tournees (driver, zone, day, status, stops)
           SELECT $1,$2,$3,'PLANIFIEE',$4 WHERE NOT EXISTS (SELECT 1 FROM tournees WHERE driver = $1 AND day = $3)`,
          [tr.driver, tr.zone, tr.day, tr.stops],
        );
      }
      for (const g of GEOFENCES[t.slug] ?? []) {
        await client.query(
          `INSERT INTO geofences (driver, name, center_lat, center_lng, radius_m)
           SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (SELECT 1 FROM geofences WHERE driver = $1)`,
          [g.driver, g.name, g.lat, g.lng, g.radius],
        );
      }
      for (const p of POSITIONS[t.slug] ?? []) {
        await client.query(
          `INSERT INTO driver_positions (driver, lat, lng)
           SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM driver_positions WHERE driver = $1)`,
          [p.driver, p.lat, p.lng],
        );
      }
      for (const inv of INVOICES[t.slug] ?? []) {
        await client.query(
          `INSERT INTO invoices (ref, merchant, period, orders_count, deliveries_amount, cod_collected, commission, net_ht, tva, status, dispute_amount, dispute_note)
           SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12 WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE ref = $1)`,
          [inv.ref, inv.merchant, inv.period, inv.orders, inv.deliveries, inv.cod, inv.commission, inv.net, inv.tva, inv.status, inv.disputeAmount ?? null, inv.disputeNote ?? null],
        );
      }
      for (const bm of BILLING_MODES[t.slug] ?? []) {
        await client.query(
          `INSERT INTO merchant_billing (merchant, mode) VALUES ($1,$2) ON CONFLICT (merchant) DO NOTHING`,
          [bm.merchant, bm.mode],
        );
      }
      for (const cs of CASH[t.slug] ?? []) {
        const res = await client.query(
          `INSERT INTO cash_sessions (driver, ini, session_date, theorique, declared, deposited, deliveries, cap, status)
           SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9
           WHERE NOT EXISTS (SELECT 1 FROM cash_sessions WHERE driver = $1 AND session_date = $3)
           RETURNING id`,
          [cs.driver, cs.ini, cs.date, cs.theorique, cs.declared, cs.deposited, cs.deliveries, cs.cap, cs.status],
        );
        const sid = res.rows[0]?.id;
        if (sid) {
          for (const m of cs.moves ?? []) {
            await client.query(
              `INSERT INTO cash_movements (session_id, ref, recipient, amount, matched) VALUES ($1,$2,$3,$4,$5)`,
              [sid, m.ref, m.recipient, m.amount, m.matched],
            );
          }
        }
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
