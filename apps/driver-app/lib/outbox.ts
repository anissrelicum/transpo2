import { ApiError } from '@transpo/api-client';
import type { Order, OrderStatus } from '@transpo/domain';
import { LIFECYCLE } from '@transpo/domain';
import { readJson, writeJson } from './storage';
import { authedClient } from './api';

const KEY = 'transpo.outbox.v1';

/**
 * File d'attente hors ligne. Une action du livreur est d'abord **écrite sur le
 * disque**, puis tentée : si le réseau manque, elle reste en file et repart plus
 * tard. La clé d'idempotence est figée à la mise en file — c'est ce qui rend le
 * rejeu sûr, y compris après redémarrage de l'app (l'API dédoublonne dessus).
 */
export type PendingAction =
  | { kind: 'advance'; ref: string; from: OrderStatus; idemKey: string }
  | { kind: 'proof'; ref: string; codCollected: number; idemKey: string };

/** L'action telle que persistée, avec son identité et sa date de mise en file. */
export type Pending = PendingAction & { id: string; at: number };

export type FlushResult = { sent: number; kept: number; rejected: { ref: string; reason: string }[] };

let cache: Pending[] | null = null;
const listeners = new Set<(q: Pending[]) => void>();

function emit(q: Pending[]) {
  cache = q;
  for (const l of listeners) l(q);
}

/** S'abonner à l'état de la file (bandeau « en attente », compteurs). */
export function subscribe(fn: (q: Pending[]) => void): () => void {
  listeners.add(fn);
  if (cache) fn(cache);
  return () => listeners.delete(fn);
}

export async function load(): Promise<Pending[]> {
  if (cache) return cache;
  const q = await readJson<Pending[]>(KEY, []);
  emit(q);
  return q;
}

async function save(q: Pending[]): Promise<void> {
  emit(q);
  await writeJson(KEY, q);
}

export async function clear(): Promise<void> {
  await save([]);
}

/** Met une action en file. Retourne l'entrée persistée. */
export async function enqueue(entry: PendingAction): Promise<Pending> {
  const q = await load();
  const full: Pending = { ...entry, id: `${entry.kind}:${entry.ref}:${entry.idemKey}`, at: Date.now() };
  // Même action déjà en file (double appui, rejeu) : on ne l'empile pas deux fois.
  if (q.some((p) => p.id === full.id)) return full;
  await save([...q, full]);
  return full;
}

async function send(p: Pending): Promise<void> {
  const c = authedClient();
  if (p.kind === 'advance') await c.driverAdvance(p.ref, p.idemKey);
  else await c.driverProof(p.ref, { codCollected: p.codCollected }, p.idemKey);
}

/**
 * Vide la file dans l'ordre. Une erreur réseau interrompt la passe (on retentera) ;
 * un refus du serveur (4xx) est définitif : l'action est retirée et signalée, sinon
 * elle bloquerait la file indéfiniment.
 */
export async function flush(): Promise<FlushResult> {
  const q = await load();
  const rejected: { ref: string; reason: string }[] = [];
  let sent = 0;
  let i = 0;

  for (; i < q.length; i++) {
    const p = q[i]!;
    try {
      await send(p);
      sent++;
    } catch (e) {
      // 4xx = refus métier (mission déjà avancée, plus la sienne…) : on abandonne l'action.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        rejected.push({ ref: p.ref, reason: e.message });
        continue;
      }
      break; // réseau ou 5xx : on garde la suite pour plus tard
    }
  }

  // Tout ce qui précède `i` est parti ou a été refusé ; le reste attend la prochaine passe.
  const remaining = q.slice(i);
  await save(remaining);
  return { sent, kept: remaining.length, rejected };
}

/**
 * Reflète les actions en attente sur les missions affichées, pour que le livreur
 * voie l'état qu'il vient de produire même sans réseau.
 */
export function applyPending(orders: Order[], q: Pending[]): Order[] {
  if (q.length === 0) return orders;
  return orders.map((o) => {
    let status = o.status as OrderStatus;
    let codPaid = o.codPaid;
    for (const p of q.filter((x) => x.ref === o.ref)) {
      if (p.kind === 'advance') {
        const i = LIFECYCLE.indexOf(status);
        const next = i >= 0 ? LIFECYCLE[i + 1] : undefined;
        if (next && next !== 'LIVREE') status = next;
      } else {
        status = 'LIVREE';
        codPaid = o.cod > 0 ? p.codCollected >= o.cod : false;
      }
    }
    return { ...o, status, codPaid };
  });
}
