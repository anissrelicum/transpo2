import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import type { Order, OrderStatus, ParcelSize, ProofLevel } from '@transpo/domain';
import { LIFECYCLE, canTransition, PARCEL_SIZES, PROOF_LEVELS } from '@transpo/domain';
import { withTenantDb, orders as ordersTable, orderEvents as orderEventsTable, deliveryProofs } from '@transpo/db';
import { desc, eq } from 'drizzle-orm';
import { NotificationsService } from '../notifications/notifications.service.js';
import { normaliserLocalisation } from './localisation.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function rndCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}
let refCounter = 0;
function nextRef(): string {
  // Unique : date + base36(timestamp) + compteur process (évite les collisions sous charge).
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const uniq = (Date.now().toString(36) + (refCounter++).toString(36)).toUpperCase();
  return `CMD-${day}-${uniq}`;
}

export interface CreateOrderInput {
  merchant?: string; fromCity: string; toCity: string;
  cod?: number; size?: ParcelSize; proofLevel?: ProofLevel; scheduled?: boolean;
  // Coordonnées des deux points de la course. L'assistant les demandait déjà ; elles
  // n'étaient simplement transmises nulle part.
  pickupContact?: string; pickupPhone?: string; pickupAddress?: string; pickupNotes?: string;
  dropContact?: string; dropPhone?: string; dropAddress?: string; dropNotes?: string;
  description?: string; vehicleType?: string;
  // Localisation précise (épingle ou lien collé) — cf. migration 0027 et localisation.ts.
  pickupLat?: number | null; pickupLng?: number | null; pickupMapUrl?: string | null;
  dropLat?: number | null; dropLng?: number | null; dropMapUrl?: string | null;
}

/** Corps de `PATCH /v1/orders/:ref/locations` : un point absent du corps reste inchangé. */
export interface UpdateLocationsInput {
  pickupLat?: number | null; pickupLng?: number | null; pickupMapUrl?: string | null;
  dropLat?: number | null; dropLng?: number | null; dropMapUrl?: string | null;
}

/** Statuts où la course est close : la localisation n'a plus à bouger. */
const CLOS = ['LIVREE', 'ANNULEE', 'RETOUR'];

// 9 à 15 CHIFFRES, espaces et tirets de présentation ignorés : « +212 6 00 00 00 00 », le
// format montré en exemple dans les formulaires, comptait 18 caractères et était refusé.
const PHONE_RE = { test: (v: string) => /^\+?[0-9\s-]+$/.test(v) && /^\d{9,15}$/.test(v.replace(/[^\d]/g, '')) };
/** Nettoie une chaîne facultative : vide ou blanche → `null`. */
const texte = (v?: string): string | null => (v?.trim() ? v.trim() : null);

/**
 * Enregistre une transition au journal de la commande.
 * Écrit dans la même unité de travail que le changement de statut : un statut sans trace
 * serait exactement le trou que TC-F11 a mis au jour.
 */
async function journaliser(db: any, ref: string, status: string, actor?: string | null, note?: string | null) {
  await db.insert(orderEventsTable).values({ ref, status, actor: actor ?? null, note: note ?? null });
}

/** `tenant_rabatexpress` → `rabatexpress`. Le slug est la moitié de l'identifiant push. */
const slugDuSchema = (schema: string): string => schema.replace(/^tenant_/, '');

function rowToOrder(r: any): Order {
  return { ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt } as Order;
}

@Injectable()
export class OrdersService {
  // @Inject explicite : requis sous tsx/esbuild (pas de métadonnée de type émise).
  constructor(@Inject(NotificationsService) private readonly notifs: NotificationsService) {}

  /** Liste (filtre statut optionnel). */
  list(schema: string, status?: OrderStatus): Promise<Order[]> {
    return withTenantDb(schema, async (db) => {
      const rows = status
        ? await db.select().from(ordersTable).where(eq(ordersTable.status, status)).orderBy(desc(ordersTable.createdAt))
        : await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
      return rows.map(rowToOrder);
    });
  }

  get(schema: string, ref: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [r] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!r) throw new NotFoundException(`Commande introuvable : ${ref}`);
      return rowToOrder(r);
    });
  }

  create(schema: string, input: CreateOrderInput, actor?: string): Promise<Order> {
    // Validation du corps avant tout accès SQL : un corps vide ou incomplet
    // renvoie 400, pas une erreur de contrainte NOT NULL (500).
    const missing: string[] = [];
    if (!input?.fromCity?.trim()) missing.push('fromCity');
    if (!input?.toCity?.trim()) missing.push('toCity');
    if (missing.length) throw new BadRequestException(`Champs requis manquants : ${missing.join(', ')}.`);
    if (input.size !== undefined && !PARCEL_SIZES.includes(input.size)) {
      throw new BadRequestException(`Taille invalide : ${input.size} (attendu : ${PARCEL_SIZES.join(', ')}).`);
    }
    if (input.proofLevel !== undefined && !PROOF_LEVELS.includes(input.proofLevel)) {
      throw new BadRequestException(`Niveau de preuve invalide : ${input.proofLevel} (attendu : ${PROOF_LEVELS.join(', ')}).`);
    }
    for (const [champ, valeur] of [['pickupPhone', input.pickupPhone], ['dropPhone', input.dropPhone]] as const) {
      if (valeur?.trim() && !PHONE_RE.test(valeur.trim())) {
        throw new BadRequestException(`Téléphone invalide (${champ === 'pickupPhone' ? 'retrait' : 'livraison'}).`);
      }
    }
    const retraitLoc = normaliserLocalisation('retrait', input.pickupLat, input.pickupLng, input.pickupMapUrl);
    const livraisonLoc = normaliserLocalisation('livraison', input.dropLat, input.dropLng, input.dropMapUrl);
    return withTenantDb(schema, async (db) => {
      const row = {
        ref: nextRef(), code: rndCode(),
        status: (input.scheduled ? 'PROGRAMMEE' : 'NOUVELLE') as OrderStatus,
        merchant: input.merchant ?? null,
        fromCity: input.fromCity, toCity: input.toCity,
        driver: null as string | null,
        cod: input.cod ?? 0, codPaid: false,
        size: input.size ?? 'Moyen',
        proofLevel: (input.proofLevel ?? 'photo_signature') as ProofLevel,
        pickupContact: texte(input.pickupContact), pickupPhone: texte(input.pickupPhone),
        pickupAddress: texte(input.pickupAddress), pickupNotes: texte(input.pickupNotes),
        dropContact: texte(input.dropContact), dropPhone: texte(input.dropPhone),
        dropAddress: texte(input.dropAddress), dropNotes: texte(input.dropNotes),
        description: texte(input.description), vehicleType: texte(input.vehicleType),
        pickupLat: retraitLoc.lat, pickupLng: retraitLoc.lng, pickupMapUrl: retraitLoc.mapUrl,
        dropLat: livraisonLoc.lat, dropLng: livraisonLoc.lng, dropMapUrl: livraisonLoc.mapUrl,
      };
      const [r] = await db.insert(ordersTable).values(row).returning();
      await journaliser(db, r.ref, r.status, actor, 'Commande créée');
      return rowToOrder(r);
    }).then(async (creee) => {
      // Le client reçoit son code de suivi dès l'enregistrement : c'est ce code qui lui
      // ouvre le suivi public, et rien ne le lui communiquait jusqu'ici. L'envoi se fait
      // APRÈS l'écriture, hors de la connexion de la transaction.
      await this.notifs.notifierEvenement(schema, 'order.created', {
        recipient: creee.dropPhone, vars: { code: creee.code },
      });
      return creee;
    });
  }

  /**
   * Corrige la localisation d'un ou des deux points (épingle déplacée, nouveau lien du
   * client). Un point dont aucun champ n'est fourni reste tel quel ; `null` partout
   * l'efface. Refusé sur une course close : la position fait foi pour la preuve.
   */
  updateLocations(schema: string, ref: string, input: UpdateLocationsInput, actor?: string): Promise<Order> {
    const body = input ?? {};
    const touche = (k: 'pickup' | 'drop') =>
      [`${k}Lat`, `${k}Lng`, `${k}MapUrl`].some((c) => Object.prototype.hasOwnProperty.call(body, c));
    if (!touche('pickup') && !touche('drop')) throw new BadRequestException('Aucune localisation à mettre à jour.');
    const set: Record<string, unknown> = {};
    if (touche('pickup')) {
      const l = normaliserLocalisation('retrait', body.pickupLat, body.pickupLng, body.pickupMapUrl);
      Object.assign(set, { pickupLat: l.lat, pickupLng: l.lng, pickupMapUrl: l.mapUrl });
    }
    if (touche('drop')) {
      const l = normaliserLocalisation('livraison', body.dropLat, body.dropLng, body.dropMapUrl);
      Object.assign(set, { dropLat: l.lat, dropLng: l.lng, dropMapUrl: l.mapUrl });
    }
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      if (CLOS.includes(cur.status)) throw new BadRequestException('Course close : localisation figée.');
      const [r] = await db.update(ordersTable).set(set).where(eq(ordersTable.ref, ref)).returning();
      await journaliser(db, ref, r.status, actor, 'Localisation mise à jour');
      return rowToOrder(r);
    });
  }

  /** Fait progresser au statut suivant du cycle nominal (validé via domain). */
  advance(schema: string, ref: string, actor?: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const i = LIFECYCLE.indexOf(cur.status as OrderStatus);
      if (i < 0 || i >= LIFECYCLE.length - 1) throw new BadRequestException('Aucune progression possible.');
      const next = LIFECYCLE[i + 1];
      // La clôture d'une livraison passe par la preuve, depuis l'app livreur
      // (`/v1/driver/orders/:ref/proof`) : la console la refusait dans son menu mais
      // l'API l'acceptait, ce qui permettait de déclarer « Livrée » sans photo ni
      // signature — et donc sans rien à opposer à une contestation ou à un COD.
      if (next === 'LIVREE') {
        throw new BadRequestException('La livraison se clôture par la preuve, depuis l’app livreur.');
      }
      const [r] = await db.update(ordersTable).set({ status: next }).where(eq(ordersTable.ref, ref)).returning();
      await journaliser(db, ref, next, actor);
      return rowToOrder(r);
    }).then(async (avancee) => {
      // Mise en livraison : le client peut s'organiser pour être là. C'est le seul
      // événement de la course où une minute d'avance lui sert à quelque chose.
      if (avancee.status === 'LIVRAISON') {
        await this.notifs.notifierEvenement(schema, 'order.out', {
          recipient: avancee.dropPhone, vars: { code: avancee.code },
        });
      }
      return avancee;
    });
  }

  assign(schema: string, ref: string, driverName: string, actor?: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const status = (cur.status === 'NOUVELLE' || cur.status === 'PROGRAMMEE') ? 'ASSIGNEE' : cur.status;
      const [r] = await db.update(ordersTable).set({ driver: driverName, status }).where(eq(ordersTable.ref, ref)).returning();
      await journaliser(db, ref, status, actor, `Affectée à ${driverName}`);
      return rowToOrder(r);
    }).then(async (commande) => {
      // Le livreur apprend sa mission sur son téléphone, sans avoir à rafraîchir sa liste.
      // Comme les autres notifications, l'envoi suit l'écriture métier et ne la retient
      // jamais : une panne de passerelle ne doit pas empêcher une affectation.
      await this.notifs.notifierLivreur(schema, slugDuSchema(schema), driverName, 'driver.assigned', {
        code: commande.code, ville: commande.toCity,
      });
      return commande;
    });
  }

  cancel(schema: string, ref: string, actor?: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      if (!canTransition(cur.status as OrderStatus, 'ANNULEE')) throw new BadRequestException('Annulation impossible.');
      const [r] = await db.update(ordersTable).set({ status: 'ANNULEE' }).where(eq(ordersTable.ref, ref)).returning();
      await journaliser(db, ref, 'ANNULEE', actor);
      return rowToOrder(r);
    });
  }

  /** Journal des transitions d'une commande, du plus ancien au plus récent. */
  events(schema: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const rows = await db.select().from(orderEventsTable)
        .where(eq(orderEventsTable.ref, ref))
        .orderBy(orderEventsTable.at);
      return rows.map((e: any) => ({
        status: e.status,
        actor: e.actor,
        note: e.note,
        at: e.at instanceof Date ? e.at.toISOString() : e.at,
      }));
    });
  }

  /**
   * Preuve de livraison d'une commande. `captured: false` quand le livreur n'a
   * rien déposé — le cas normal pour une commande de niveau « aucune », ou pour
   * les livraisons antérieures à l'application de la règle.
   */
  proof(schema: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const [p] = await db.select().from(deliveryProofs).where(eq(deliveryProofs.ref, ref));
      if (!p) return { ref, proofLevel: o.proofLevel, captured: false, photo: null, signature: null, capturedBy: null, capturedAt: null };
      return {
        ref, proofLevel: o.proofLevel, captured: true,
        photo: p.photo, signature: p.signature,
        capturedBy: p.capturedBy, capturedAt: p.capturedAt.toISOString(),
      };
    });
  }
}
