import { pgTable, text, integer, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';

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

