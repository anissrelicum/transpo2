import { Injectable } from '@nestjs/common';
import { withTenantDb, orders as ordersTable } from '@transpo/db';
import { isNotNull } from 'drizzle-orm';

export interface ReviewRow {
  ref: string; merchant: string | null; driver: string | null;
  rating: number; comment: string | null; city: string; createdAt: string;
}

/** Moyenne arrondie au dixième ; `null` si aucun avis. */
function avgOf(ratings: number[]): number | null {
  if (!ratings.length) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

@Injectable()
export class ReviewsService {
  /**
   * Avis clients : notes 1..5 laissées après livraison, avec la distribution
   * et les moyennes par livreur et par marchand (classées, moins bonnes d'abord).
   */
  list(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable).where(isNotNull(ordersTable.rating));

      const reviews: ReviewRow[] = rows
        .map((o) => ({
          ref: o.ref, merchant: o.merchant, driver: o.driver,
          rating: o.rating as number, comment: o.ratingComment, city: o.toCity,
          createdAt: o.createdAt.toISOString(),
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const ratings = reviews.map((r) => r.rating);
      const distribution = [1, 2, 3, 4, 5].map((stars) => ({
        stars, count: ratings.filter((r) => r === stars).length,
      }));

      const group = (key: 'driver' | 'merchant') => {
        const acc = new Map<string, number[]>();
        for (const r of reviews) {
          const k = r[key];
          if (!k) continue;
          acc.set(k, [...(acc.get(k) ?? []), r.rating]);
        }
        return [...acc.entries()]
          .map(([name, rs]) => ({ name, count: rs.length, avg: avgOf(rs)! }))
          .sort((a, b) => a.avg - b.avg || b.count - a.count);
      };

      return {
        reviews,
        total: reviews.length,
        average: avgOf(ratings),
        // Un avis à 1 ou 2 étoiles est considéré comme négatif (à traiter par les ops).
        negatives: ratings.filter((r) => r <= 2).length,
        withComment: reviews.filter((r) => !!r.comment).length,
        distribution,
        byDriver: group('driver'),
        byMerchant: group('merchant'),
      };
    });
  }
}
