import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

// Tables d'un tenant. Volontairement NON qualifiées d'un schéma :
// elles sont résolues au runtime via `SET search_path TO tenant_<x>` (cf. client.withTenantDb).
export const orders = pgTable('orders', {
  ref: text('ref').primaryKey(),
  code: text('code').notNull(),
  status: text('status').notNull(),
  merchant: text('merchant'),
  fromCity: text('from_city').notNull(),
  toCity: text('to_city').notNull(),
  driver: text('driver'),
  cod: integer('cod').notNull().default(0),
  codPaid: boolean('cod_paid').notNull().default(false),
  size: text('size'),
  proofLevel: text('proof_level').notNull().default('photo_signature'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
