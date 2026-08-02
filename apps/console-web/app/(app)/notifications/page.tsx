import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { NotificationRow, NotifTemplate } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { NotificationsView } from '../../../components/NotificationsView';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  let notifications: NotificationRow[] = [];
  let templates: NotifTemplate[] = [];
  try {
    const c = serverClient();
    [notifications, templates] = await Promise.all([c.getNotifications(), c.getNotifTemplates()]);
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <NotificationsView notifications={notifications} templates={templates} canWrite={canWrite} />
    </Box>
  );
}
