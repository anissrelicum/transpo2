// @transpo/ui-web — primitives web (Radix). Fidèles à la maquette, alimentées par domain/i18n.
import * as React from 'react';
import { Badge } from '@radix-ui/themes';
import { STATUS_META, money, type OrderStatus } from '@transpo/domain';
import { statusLabel, type Lang } from '@transpo/i18n';

export { money };

/** Badge de statut : couleur figée (domain) + libellé localisé (i18n). */
export function StatusBadge({ status, lang = 'fr' }: { status: OrderStatus; lang?: Lang }) {
  const color = STATUS_META[status].color as React.ComponentProps<typeof Badge>['color'];
  return <Badge color={color} variant="soft" radius="full">{statusLabel(status, lang)}</Badge>;
}

/** Puce COD (ambre à encaisser / vert encaissé). */
export function CodChip({ amount, paid, lang = 'fr' }: { amount: number; paid: boolean; lang?: Lang }) {
  if (!amount) return <span style={{ color: 'var(--gray-9)' }}>—</span>;
  const label = lang === 'ar'
    ? (paid ? 'حُصّل: ' : 'للتحصيل: ')
    : (paid ? 'COD encaissé · ' : 'COD à encaisser · ');
  return <Badge color={paid ? 'green' : 'amber'} variant="soft" radius="full">{label + money(amount)}</Badge>;
}
