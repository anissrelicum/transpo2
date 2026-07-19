import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// Schéma global de la plateforme (données non rattachées à un tenant).
export const platform = pgSchema('platform');

export const tenants = platform.table('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(), // = suffixe du schéma tenant (tenant_<slug>)
  name: text('name').notNull(),
  city: text('city'),
  plan: text('plan').notNull().default('Essai'),
  status: text('status').notNull().default('ESSAI'), // ACTIF | ESSAI | SUSPENDU | IMPAYÉ
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
