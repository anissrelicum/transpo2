import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { NotifTemplate } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { TemplatesView } from '../../../components/TemplatesView';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const isAdmin = (cookies().get('role')?.value || '') === 'ADMIN';
  let templates: NotifTemplate[] = [];
  try {
    templates = await serverClient().getNotifTemplates();
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <TemplatesView templates={templates} isAdmin={isAdmin} />
    </Box>
  );
}
