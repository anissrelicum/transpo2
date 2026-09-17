import { Injectable, BadRequestException } from '@nestjs/common';
import { pool, demoRequests } from '@transpo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { desc, eq, sql as raw } from 'drizzle-orm';

/**
 * Demandes de démonstration déposées depuis le site vitrine.
 *
 * C'est la SEULE écriture publique de la plateforme : n'importe qui sur Internet peut
 * l'appeler, sans compte. Elle est donc bornée de trois façons — longueurs plafonnées,
 * doublon récent refusé, et plafond horaire global. Le comptage par source, lui, ne
 * protégerait rien ici : derrière l'ingress, l'adresse du client ne parvient pas jusqu'à
 * l'API (cf. le correctif anti-bruteforce du 14/09), et compter tout le monde sous une
 * clé commune reviendrait à laisser un seul robot fermer le formulaire à tout le monde.
 */
const LIMITES = { societe: 120, nom: 120, email: 160, telephone: 40, villes: 200, message: 2000 };
const PLAFOND_HORAIRE = 60;
const FENETRE_DOUBLON_H = 24;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface DemandeEntrante {
  societe?: string; nom?: string; email?: string; telephone?: string;
  villes?: string; livreurs?: number | string; message?: string; source?: string;
}

const db = () => drizzle(pool);

/** Nettoie et borne une chaîne ; vide → `null`. */
const texte = (v: unknown, max: number): string | null => {
  const t = String(v ?? '').trim().replace(/\s+/g, ' ');
  return t ? t.slice(0, max) : null;
};

@Injectable()
export class DemoService {
  /** Dépôt public. Rend un accusé minimal : rien de ce qui est en base ne ressort. */
  async deposer(entree: DemandeEntrante) {
    const societe = texte(entree.societe, LIMITES.societe);
    const nom = texte(entree.nom, LIMITES.nom);
    const email = texte(entree.email, LIMITES.email);
    if (!societe || !nom || !email) {
      throw new BadRequestException('Société, nom et e-mail sont nécessaires.');
    }
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Adresse e-mail invalide.');

    // Un même prospect qui insiste ne doit pas encombrer la liste. On ACCEPTE quand même,
    // sans rien écrire : lui répondre « déjà envoyé » l'inviterait à sonder la base.
    const { rows: recents } = await pool.query(
      `SELECT 1 FROM platform.demo_requests
        WHERE lower(email) = lower($1) AND created_at > now() - interval '${FENETRE_DOUBLON_H} hours'
        LIMIT 1`,
      [email],
    );
    if (recents.length) return { ok: true };

    const { rows: [{ n }] } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM platform.demo_requests WHERE created_at > now() - interval '1 hour'`,
    );
    if (Number(n) >= PLAFOND_HORAIRE) {
      throw new BadRequestException('Trop de demandes en ce moment. Réessayez dans un moment.');
    }

    const livreurs = Number(entree.livreurs);
    await db().insert(demoRequests).values({
      societe, nom, email,
      telephone: texte(entree.telephone, LIMITES.telephone),
      villes: texte(entree.villes, LIMITES.villes),
      livreurs: Number.isFinite(livreurs) && livreurs > 0 ? Math.min(Math.round(livreurs), 100000) : null,
      message: texte(entree.message, LIMITES.message),
      source: entree.source === 'accroche' ? 'accroche' : 'contact',
    });
    return { ok: true };
  }

  /** Liste pour la console plateforme, la plus récente d'abord. */
  async lister(statut?: string) {
    const q = db().select().from(demoRequests).orderBy(desc(demoRequests.createdAt)).limit(500);
    const lignes = statut ? await q.where(eq(demoRequests.statut, statut)) : await q;
    return lignes;
  }

  /** Suivi interne : marquer contactée ou archivée, avec une note. */
  async suivre(id: string, statut: string, note?: string) {
    const permis = ['NOUVELLE', 'CONTACTE', 'ARCHIVEE'];
    if (!permis.includes(statut)) throw new BadRequestException(`Statut inconnu : ${statut}.`);
    const [r] = await db().update(demoRequests)
      .set({
        statut,
        note: texte(note, 2000),
        // La date de traitement marque la SORTIE de « nouvelle » : y revenir l'efface,
        // sinon une demande rouverte porterait une date de traitement qui ment.
        handledAt: statut === 'NOUVELLE' ? null : raw`now()`,
      })
      .where(eq(demoRequests.id, id))
      .returning();
    if (!r) throw new BadRequestException('Demande introuvable.');
    return r;
  }
}
