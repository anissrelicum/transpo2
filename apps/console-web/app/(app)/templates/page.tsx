import * as React from 'react';
import { Badge, Text } from '@radix-ui/themes';
import { NOTIF_TEMPLATES } from '@transpo/domain';
import { PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

type Tpl = { event: string; fr: string; ar: string; transactional: boolean };

export default function TemplatesPage() {
  const rows: Tpl[] = Object.entries(NOTIF_TEMPLATES).map(([event, t]) => ({ event, ...t }));
  return (
    <Box style={wrap}>
      <PageTitle title="Modèles de notification" subtitle="Gabarits bilingues FR/AR. Les modèles marketing exigent un consentement." />
      <DataTable<Tpl>
        columns={[
          { key: 'event', label: 'Événement', render: (t) => <Text weight="medium">{t.event}</Text> },
          { key: 'fr', label: 'Français', render: (t) => <Text size="2">{t.fr}</Text> },
          { key: 'ar', label: 'العربية', render: (t) => <Text size="2" style={{ direction: 'rtl' }}>{t.ar}</Text> },
          { key: 'transactional', label: 'Type', render: (t) => (
            <Badge color={t.transactional ? 'green' : 'amber'}>{t.transactional ? 'Transactionnel' : 'Marketing'}</Badge>
          ) },
        ]}
        rows={rows}
      />
    </Box>
  );
}
