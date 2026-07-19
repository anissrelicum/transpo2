import * as React from 'react';
import { cookies } from 'next/headers';
import { Card, Flex, Text, Badge, Separator } from '@radix-ui/themes';
import { COMMISSION_RATE, VAT_RATE } from '@transpo/domain';
import { PageTitle, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex align="center" justify="between" py="2">
      <Text size="2" color="gray">{label}</Text>
      <Text size="2" weight="medium">{children}</Text>
    </Flex>
  );
}

export default function SettingsPage() {
  const tenant = cookies().get('tenant')?.value || '—';
  return (
    <Box style={{ ...wrap, maxWidth: 640 }}>
      <PageTitle title="Paramètres" subtitle="Configuration de l’organisation." />
      <Card size="3">
        <Row label="Organisation (tenant)"><Badge color="indigo">{tenant}</Badge></Row>
        <Separator size="4" />
        <Row label="Commission plateforme">{Math.round(COMMISSION_RATE * 100)} %</Row>
        <Separator size="4" />
        <Row label="TVA">{Math.round(VAT_RATE * 100)} %</Row>
        <Separator size="4" />
        <Row label="Thème">Bascule clair/sombre dans la barre du haut</Row>
        <Separator size="4" />
        <Row label="Langues">FR / AR (RTL)</Row>
      </Card>
    </Box>
  );
}
