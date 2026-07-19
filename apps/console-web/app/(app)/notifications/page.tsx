import * as React from 'react';
import { cookies } from 'next/headers';
import { Badge, Text, Flex } from '@radix-ui/themes';
import type { NotificationRow } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';
import { CreateDialog } from '../../../components/CreateDialog';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { SENT: 'green', QUEUED: 'blue', BLOCKED: 'red' };

export default async function NotificationsPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  const notifs = await load((c) => c.getNotifications());
  return (
    <Box style={wrap}>
      <Flex justify="between" align="end">
        <PageTitle title="Centre de notifications" subtitle="Historique des envois (consentement loi 09-08 appliqué)." />
        {canWrite && (
          <Box mb="4"><CreateDialog title="Envoyer une notification" trigger="Envoyer" path="v1/notifications/send"
            fields={[
              { name: 'event', label: 'Événement', type: 'select', options: ['order.created', 'order.out', 'order.delivered', 'order.failed', 'promo'] },
              { name: 'channel', label: 'Canal', type: 'select', options: ['SMS', 'WHATSAPP', 'PUSH', 'EMAIL'] },
              { name: 'recipient', label: 'Destinataire', placeholder: '+212600000000' },
              { name: 'lang', label: 'Langue', type: 'select', options: ['fr', 'ar'] },
              { name: 'code', label: 'Variable {code} / {x}', placeholder: 'TRACK123' },
            ]}
            varsMap={{ code: 'code', x: 'code' }}
          /></Box>
        )}
      </Flex>
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
