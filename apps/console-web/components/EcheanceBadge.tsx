'use client';
// Échéance d'une commande (ADR 0006) : à l'heure, bientôt, en retard, ou livrée avec retard.
import * as React from 'react';
import { Badge, Tooltip } from '@radix-ui/themes';
import { describeDelay, type DelayMode } from '@transpo/domain';

type Commande = {
  status: string; delayMode?: DelayMode | string | null; delayMinutes?: number | null; delayHeure?: string | null;
  retraitMinutes?: number | null; dueAt?: string | null; pickupDueAt?: string | null; lateMinutes?: number | null;
};

// Heure affichée dans le fuseau de l'entreprise, identique côté serveur et navigateur
// (sans quoi le rendu serveur et l'hydratation divergent).
const TZ = 'Africa/Casablanca';
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

/** Heure courante rafraîchie toutes les 30 s, `null` au premier rendu (pas de décalage d'hydratation). */
function useMaintenant(): number | null {
  const [t, setT] = React.useState<number | null>(null);
  React.useEffect(() => {
    setT(Date.now());
    const id = setInterval(() => setT(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export function EcheanceBadge({ o }: { o: Commande }) {
  const now = useMaintenant();
  const mode = (o.delayMode ?? 'aucun') as DelayMode;
  if (o.status === 'LIVREE') {
    if (!o.dueAt) return null;
    return o.lateMinutes
      ? <Badge color="red" variant="soft">Livrée avec {o.lateMinutes} min de retard</Badge>
      : <Badge color="green" variant="soft">Livrée à l’heure</Badge>;
  }
  if (['ANNULEE', 'ECHOUEE', 'RETOUR'].includes(o.status) || mode === 'aucun') return null;
  const enMain = o.status === 'RECUPEREE' || o.status === 'LIVRAISON';
  const echeance = [o.dueAt, enMain ? null : o.pickupDueAt].filter(Boolean).sort()[0] as string | undefined;
  const regle = describeDelay({ mode, minutes: o.delayMinutes, heure: o.delayHeure });
  if (!echeance) return <Tooltip content="L’échéance démarre au retrait"><Badge color="gray" variant="soft">{regle}</Badge></Tooltip>;
  const quoi = echeance === o.pickupDueAt && !enMain ? 'Retrait' : 'Livraison';
  if (now == null) return <Badge color="gray" variant="soft">{quoi} avant {hhmm(echeance)}</Badge>;
  const reste = Math.round((new Date(echeance).getTime() - now) / 60_000);
  if (reste < 0) return <Badge color="red" variant="solid">En retard de {-reste} min</Badge>;
  return (
    <Tooltip content={regle}>
      <Badge color={reste <= 15 ? 'orange' : reste <= 60 ? 'amber' : 'gray'} variant="soft">
        {quoi} avant {hhmm(echeance)}{reste <= 60 ? ` · ${reste} min` : ''}
      </Badge>
    </Tooltip>
  );
}
