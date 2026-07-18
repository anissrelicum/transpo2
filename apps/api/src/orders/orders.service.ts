import { Injectable } from '@nestjs/common';
import type { Order } from '@transpo/domain';
import { withTenant } from '../db/pool.js';

@Injectable()
export class OrdersService {
  /** Liste les commandes du tenant courant (schéma isolé). */
  list(schema: string): Promise<Order[]> {
    return withTenant(schema, async (client) => {
      const { rows } = await client.query(
        `SELECT ref, code, status, merchant,
                from_city  AS "fromCity",
                to_city    AS "toCity",
                driver, cod,
                cod_paid   AS "codPaid",
                size,
                proof_level AS "proofLevel",
                created_at  AS "createdAt"
         FROM orders
         ORDER BY created_at DESC`,
      );
      return rows as Order[];
    });
  }
}
