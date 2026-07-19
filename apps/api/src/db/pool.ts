// Le pool et les helpers tenant vivent désormais dans @transpo/db (source unique).
// Ce module ré-exporte pour ne pas casser les imports internes de l'API.
export { pool, withTenantDb, platformDb } from '@transpo/db';
