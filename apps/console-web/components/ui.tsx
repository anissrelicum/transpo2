import * as React from 'react';
import { Card, Flex, Box, Text, Heading } from '@radix-ui/themes';

// Primitives reprises de la maquette (lib.jsx) — mêmes tailles/couleurs/espacements.

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <Flex align="end" justify="between" gap="4" wrap="wrap" mb="4">
      <Box>
        <Heading size="6" weight="bold">{title}</Heading>
        {subtitle && <Text as="p" size="2" color="gray" mt="1">{subtitle}</Text>}
      </Box>
      {actions && <Flex gap="2" align="center">{actions}</Flex>}
    </Flex>
  );
}

export function KPI({ label, value, delta, deltaColor, icon, accent = 'indigo' }: {
  label: string; value: string; delta?: string;
  deltaColor?: 'gray' | 'green' | 'amber' | 'red' | 'indigo' | 'cyan';
  icon?: React.ReactNode; accent?: string;
}) {
  return (
    <Card size="2">
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between">
          <Text size="1" color="gray" weight="medium">{label}</Text>
          {icon && (
            <Flex align="center" justify="center" style={{
              width: 26, height: 26, borderRadius: 'var(--radius-2)',
              background: `var(--${accent}-a3)`, color: `var(--${accent}-11)`,
            }}>{icon}</Flex>
          )}
        </Flex>
        <Heading size="7" weight="bold">{value}</Heading>
        {delta && <Text size="1" color={deltaColor || 'gray'}>{delta}</Text>}
      </Flex>
    </Card>
  );
}

/** Barres d'activité (comme la maquette : commandes créées par heure). */
export function ActivityChart({ buckets, peakHour }: { buckets: { hour: number; count: number }[]; peakHour: number }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <Flex align="end" gap="2" style={{ height: 160 }}>
      {buckets.map((b) => (
        <Flex key={b.hour} direction="column" align="center" gap="1" style={{ flex: 1 }}>
          <Box style={{
            width: '100%', height: `${(b.count / max) * 130}px`, minHeight: 2,
            background: b.hour === peakHour ? 'var(--indigo-9)' : 'var(--indigo-a5)',
            borderRadius: 'var(--radius-2) var(--radius-2) 0 0',
          }} />
          <Text size="1" color="gray" style={{ fontSize: 10 }}>
            {b.hour % 2 === 0 ? String(b.hour).padStart(2, '0') : ''}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}
