import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box, Flex, Heading, Text, Card, Table } from '@radix-ui/themes';
import { serverClient } from './server';
import type { TranspoClient } from '@transpo/api-client';

/** Charge des données via le client serveur ; redirige au login si non authentifié. */
export async function load<T>(fn: (c: TranspoClient) => Promise<T>): Promise<T> {
  try {
    return await fn(serverClient());
  } catch {
    redirect('/login');
  }
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box mb="4">
      <Heading size="6" weight="bold">{title}</Heading>
      {subtitle && <Text as="p" size="2" color="gray" mt="1">{subtitle}</Text>}
    </Box>
  );
}

/** Table simple à partir de colonnes + lignes. */
export function DataTable<T extends { [k: string]: any }>({
  columns, rows, empty = 'Aucune donnée.',
}: {
  columns: { key: string; label: string; align?: 'right'; render?: (row: T) => React.ReactNode }[];
  rows: T[];
  empty?: string;
}) {
  return (
    <Card size="1">
      <Table.Root variant="ghost">
        <Table.Header>
          <Table.Row>
            {columns.map((c) => (
              <Table.ColumnHeaderCell key={c.key} align={c.align}>{c.label}</Table.ColumnHeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.length === 0 && (
            <Table.Row><Table.Cell colSpan={columns.length}><Text size="2" color="gray">{empty}</Text></Table.Cell></Table.Row>
          )}
          {rows.map((row, i) => (
            <Table.Row key={i}>
              {columns.map((c, j) => (
                j === 0
                  ? <Table.RowHeaderCell key={c.key}>{c.render ? c.render(row) : row[c.key]}</Table.RowHeaderCell>
                  : <Table.Cell key={c.key} align={c.align}>{c.render ? c.render(row) : row[c.key]}</Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Card>
  );
}

export const wrap = { maxWidth: 1100, margin: '0 auto' } as const;
export { Box, Flex, Heading, Text, Card };
