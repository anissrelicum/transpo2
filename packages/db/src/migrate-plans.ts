// Amorçage du catalogue de plans en base + rattrapage des abonnements (spec §10).
// Rejouable : chaque étape est conditionnée à l'absence de la donnée.
// Lancement : pnpm --filter @transpo/db migrate-plans   (après `migrate`)
import { SAAS_PLANS, TRIAL_DAYS, type SubscriptionStatus } from '@transpo/domain';
import { pool } from './client.js';

/** Code stable et URL-safe du plan. Le libellé d'origine devient `label_fr`. */
const CODES: Record<string, string> = {
  'Essai': 'essai',
  'TPE Coursier': 'tpe-coursier',
  'Transporteur': 'transporteur',
  'Entreprise': 'entreprise',
};

/** Libellés arabes d'amorçage — éditables ensuite depuis /saas/plans. */
const LABELS_AR: Record<string, string> = {
  'Essai': 'تجربة',
  'TPE Coursier': 'ناقل صغير',
  'Transporteur': 'ناقل',
  'Entreprise': 'مؤسسة',
};

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  ESSAI: 'ESSAI', ACTIF: 'ACTIF', SUSPENDU: 'SUSPENDU',
};

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const period = (d: Date): string => d.toISOString().slice(0, 7);
const plusDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86400000);
const firstOfNextMonth = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

async function main(): Promise<void> {
  const client = await pool.connect();
  const today = new Date();
  let createdPlans = 0;
  let createdVersions = 0;
  let createdSubs = 0;

  try {
    await client.query('BEGIN');

    // 1) Catalogue : un plan + sa version 1 par entrée de SAAS_PLANS.
    for (const [i, p] of SAAS_PLANS.entries()) {
      const code = CODES[p.code] ?? p.code.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const ins = await client.query(
        `INSERT INTO platform.plans (code, label_fr, label_ar, sort_order)
         VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING RETURNING id`,
        [code, p.label, LABELS_AR[p.code] ?? p.label, i],
      );
      createdPlans += ins.rowCount ?? 0;

      const { rows: [plan] } = await client.query<{ id: string }>(
        'SELECT id FROM platform.plans WHERE code = $1', [code],
      );

      // Version 1 : reprise à l'identique du tarif en dur, dépassement NON facturé
      // (overage_centimes NULL) pour préserver exactement le comportement actuel.
      const has = await client.query('SELECT 1 FROM platform.plan_versions WHERE plan_id = $1', [plan.id]);
      if (!has.rowCount) {
        await client.query(
          `INSERT INTO platform.plan_versions
             (plan_id, version, billing_mode, monthly_centimes, included_orders, overage_centimes, effective_from)
           VALUES ($1, 1, 'FORFAIT', $2, $3, NULL, $4)`,
          [plan.id, p.monthlyDH * 100, p.maxOrdersMonth, iso(today)],
        );
        createdVersions++;
      }
    }

    // 2) Un abonnement pour chaque tenant qui n'en a pas encore.
    const { rows: tenants } = await client.query<{
      id: string; slug: string; plan: string; status: string; created_at: Date;
    }>(`SELECT t.id, t.slug, t.plan, t.status, t.created_at
          FROM platform.tenants t
         WHERE NOT EXISTS (
           SELECT 1 FROM platform.subscriptions s
            WHERE s.tenant_id = t.id AND s.ended_at IS NULL
         )`);

    for (const t of tenants) {
      // Rattachement par libellé : c'est ce que `tenants.plan` contient aujourd'hui.
      const { rows: [version] } = await client.query<{ id: string }>(
        `SELECT v.id FROM platform.plan_versions v
           JOIN platform.plans p ON p.id = v.plan_id
          WHERE p.label_fr = $1 AND v.effective_to IS NULL
          LIMIT 1`,
        [t.plan],
      );
      if (!version) {
        console.warn(`  ! ${t.slug} : plan « ${t.plan} » absent du catalogue — abonnement non créé.`);
        continue;
      }

      const status = STATUS_MAP[t.status] ?? 'ACTIF';
      // PIÈGE (spec §10.4) : recalculer trial_ends_at depuis created_at suspendrait tout
      // le parc au premier passage du cron. L'essai repart de la date de migration.
      const trialEndsAt = status === 'ESSAI' ? iso(plusDays(today, TRIAL_DAYS)) : null;

      await client.query(
        `INSERT INTO platform.subscriptions
           (tenant_id, plan_version_id, status, started_at, trial_ends_at, current_period, renews_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          t.id, version.id, status, iso(t.created_at), trialEndsAt,
          period(today), iso(firstOfNextMonth(today)),
        ],
      );
      createdSubs++;
    }

    await client.query('COMMIT');
    console.log(
      `Catalogue OK — ${createdPlans} plan(s), ${createdVersions} version(s) de tarif, ` +
        `${createdSubs} abonnement(s) créé(s) sur ${tenants.length} tenant(s) sans abonnement.`,
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
