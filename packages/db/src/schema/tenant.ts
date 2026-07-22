import { pgTable, text, integer, boolean, timestamp, uuid, jsonb, doublePrecision } from 'drizzle-orm/pg-core';

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
  rating: integer('rating'),
  ratingComment: text('rating_comment'),
  hubPhase: text('hub_phase'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  city: text('city'),
  vehicle: text('vehicle'),
  available: boolean('available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameFr: text('name_fr').notNull(),
  nameAr: text('name_ar'),
  color: text('color').notNull().default('indigo'),
  commune: text('commune'),
  drivers: text('drivers').array().notNull().default([]),
  centerLat: doublePrecision('center_lat'),
  centerLng: doublePrecision('center_lng'),
  region: text('region'),
  province: text('province'),
  polygon: jsonb('polygon'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  plate: text('plate').notNull().unique(),
  type: text('type').notNull(),
  city: text('city'),
  state: text('state').notNull().default('ACTIF'),
  insuranceDue: text('insurance_due'),
  ctDue: text('ct_due'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const returns = pgTable('returns', {
  ref: text('ref').primaryKey(),
  reason: text('reason').notNull(),
  attempts: integer('attempts').notNull().default(1),
  status: text('status').notNull().default('A_TRAITER'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  driver: text('driver').notNull(),
  ref: text('ref'),
  type: text('type').notNull(),
  note: text('note'),
  status: text('status').notNull().default('OUVERT'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supportMessages = pgTable('support_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  driver: text('driver').notNull(),
  sender: text('sender').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const driverPositions = pgTable('driver_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  driver: text('driver').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export const geofences = pgTable('geofences', {
  id: uuid('id').primaryKey().defaultRandom(),
  driver: text('driver').notNull(),
  name: text('name').notNull(),
  centerLat: doublePrecision('center_lat').notNull(),
  centerLng: doublePrecision('center_lng').notNull(),
  radiusM: integer('radius_m').notNull().default(5000),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  response: jsonb('response').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifConsents = pgTable('notif_consents', {
  subject: text('subject').notNull(),
  channel: text('channel').notNull(),
  optedIn: boolean('opted_in').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  event: text('event').notNull(),
  channel: text('channel').notNull(),
  recipient: text('recipient').notNull(),
  lang: text('lang').notNull().default('fr'),
  body: text('body').notNull(),
  status: text('status').notNull().default('QUEUED'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tournees = pgTable('tournees', {
  id: uuid('id').primaryKey().defaultRandom(),
  driver: text('driver').notNull(),
  zone: text('zone'),
  day: text('day').notNull(),
  status: text('status').notNull().default('PLANIFIEE'),
  stops: text('stops').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const fraudCases = pgTable('fraud_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  driver: text('driver').notNull(),
  amount: integer('amount').notNull().default(0),
  signals: text('signals').array().notNull().default([]),
  score: integer('score').notNull().default(0),
  status: text('status').notNull().default('OUVERT'),
  summary: text('summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Sessions de caisse : réconciliation COD par livreur et par jour.
export const cashSessions = pgTable('cash_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  driver: text('driver').notNull(),
  ini: text('ini').notNull(),
  sessionDate: text('session_date').notNull(),
  theorique: integer('theorique').notNull().default(0),
  declared: integer('declared'),
  deposited: integer('deposited').notNull().default(0),
  deliveries: integer('deliveries').notNull().default(0),
  cap: integer('cap').notNull().default(6000),
  status: text('status').notNull().default('EN_COURS'),
  reason: text('reason'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cashMovements = pgTable('cash_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  ref: text('ref').notNull(),
  recipient: text('recipient').notNull(),
  amount: integer('amount').notNull(),
  matched: boolean('matched').notNull().default(true),
});

// Factures marchand (service de livraison : commission 15 % + TVA 20 %).
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  ref: text('ref').notNull(),
  merchant: text('merchant').notNull(),
  period: text('period').notNull(),
  ordersCount: integer('orders_count').notNull().default(0),
  deliveriesAmount: integer('deliveries_amount').notNull().default(0),
  codCollected: integer('cod_collected').notNull().default(0),
  commission: integer('commission').notNull().default(0),
  netHt: integer('net_ht').notNull().default(0),
  tva: integer('tva').notNull().default(0),
  status: text('status').notNull().default('BROUILLON'),
  disputeAmount: integer('dispute_amount'),
  disputeNote: text('dispute_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const merchantBilling = pgTable('merchant_billing', {
  merchant: text('merchant').primaryKey(),
  mode: text('mode').notNull().default('prepaid'),
});

// Configuration tarifaire par tenant (grille + suppléments + remise), lue par le devis.
export const pricingConfig = pgTable('pricing_config', {
  id: text('id').primaryKey().default('default'),
  tiers: jsonb('tiers').notNull().default([]),
  fragileSurcharge: integer('fragile_surcharge').notNull().default(15),
  scheduledSurcharge: integer('scheduled_surcharge').notNull().default(10),
  discountRate: doublePrecision('discount_rate').notNull().default(0.1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Reversements COD : cash encaissé pour le marchand, à lui reverser.
export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchant: text('merchant').notNull(),
  period: text('period').notNull(),
  ordersCount: integer('orders_count').notNull().default(0),
  codAmount: integer('cod_amount').notNull().default(0),
  status: text('status').notNull().default('EN_ATTENTE'),
  method: text('method'),
  reference: text('reference'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

