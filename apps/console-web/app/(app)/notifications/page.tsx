import * as React from 'react';
import { Badge, Text } from '@radix-ui/themes';
import type { NotificationRow } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { SENT: 'green', QUEUED: 'blue', BLOCKED: 'red' };

export default async function NotificationsPage() {
  const notifs = await load((c) => c.getNotifications());
  return (
    <Box style={wrap}>
      <PageTitle title="Centre de notifications" subtitle="Historique des envois (consentement loi 09-08 appliqué)." />
      <DataTable<NotificationRow>
        columns={[
          { key: 'event', label: 'Événement' },
          { key: 'channel', label: 'Canal', render: (n) => <Badge variant="soft">{n.channel}</Badge> },
          { key: 'recipient', label: 'Destinataire' },
          { key: 'body', label: 'Message', render: (n) => <Text size="1" color="gray" style={n.lang === 'ar' ? { direction: 'rtl' } : undefined}>{n.body}</Text> },
          { key: 'status', label: 'Statut', render: (n) => <Badge color={(COLOR[n.status] as any) || 'gray'}>{n.status}</Badge> },
        ]}
        rows={notifs}
        empty="Aucune notification envoyée."
      />
    </Box>
  );
}
