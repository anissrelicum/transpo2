import { pgSchema, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

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

/**
 * Demandes de démonstration déposées depuis le site vitrine.
 *
 * Rattachées à aucun tenant : celui qui les dépose n'est pas encore client. C'est la seule
 * écriture PUBLIQUE de la plateforme — le service qui l'expose borne donc les longueurs et
 * refuse les doublons récents.
 */
export const demoRequests = platform.table('demo_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  societe: text('societe').notNull(),
  nom: text('nom').notNull(),
  email: text('email').notNull(),
  telephone: text('telephone'),
  villes: text('villes'),
  livreurs: integer('livreurs'),
  message: text('message'),
  source: text('source').notNull().default('contact'),
  statut: text('statut').notNull().default('NOUVELLE'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  handledAt: timestamp('handled_at', { withTimezone: true }),
});
