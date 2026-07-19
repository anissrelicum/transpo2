'use client';
import * as React from 'react';
import { Card, Flex, Box, Text, Table, Badge, Progress, Avatar } from '@radix-ui/themes';
import { GlobeIcon, PersonIcon, ArchiveIcon } from '@radix-ui/react-icons';
import { Tabs } from '@radix-ui/themes';
import { money } from '@transpo/ui-web';

export type CityRow = { city: string; volume: number; success: number };
export type DriverRow = { driver: string; deliveries: number; total: number; success: number };
export type MerchantRow = { merchant: string; deliveries: number; success: number; revenue: number };

const slaColor = (v: number) => (v >= 90 ? 'green' : v >= 85 ? 'amber' : 'red') as 'green' | 'amber' | 'red';
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

export function AnalyticsTables({ byCity, byDriver, byMerchant }: {
  byCity: CityRow[]; byDriver: DriverRow[]; byMerchant: MerchantRow[];
}) {
  return (
    <Tabs.Root defaultValue="cities">
      <Tabs.List>
        <Tabs.Trigger value="cities"><GlobeIcon /> Par ville</Tabs.Trigger>
        <Tabs.Trigger value="drivers"><PersonIcon /> Par livreur</Tabs.Trigger>
        <Tabs.Trigger value="merchants"><ArchiveIcon /> Par marchand</Tabs.Trigger>
      </Tabs.List>

      <Box pt="3">
        <Tabs.Content value="cities">
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Ville (destination)</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Volume</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Taux de réussite</Table.ColumnHeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {byCity.length === 0 && <Table.Row><Table.Cell colSpan={3}><Text size="2" color="gray">Aucune donnée.</Text></Table.Cell></Table.Row>}
                {byCity.map((z) => (
                  <Table.Row key={z.city} align="center">
                    <Table.RowHeaderCell><Text size="2" weight="medium">{z.city}</Text></Table.RowHeaderCell>
                    <Table.Cell align="right"><Text size="2">{z.volume}</Text></Table.Cell>
                    <Table.Cell><Flex align="center" gap="2" style={{ minWidth: 140 }}><Box style={{ flex: 1 }}><Progress value={z.success} color={slaColor(z.success)} /></Box><Badge color={slaColor(z.success)} variant="soft" radius="full">{z.success} %</Badge></Flex></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="drivers">
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Livreur</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Livraisons</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Assignées</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Taux de réussite</Table.ColumnHeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {byDriver.length === 0 && <Table.Row><Table.Cell colSpan={4}><Text size="2" color="gray">Aucune donnée.</Text></Table.Cell></Table.Row>}
                {byDriver.map((d) => (
                  <Table.Row key={d.driver} align="center">
                    <Table.RowHeaderCell><Flex align="center" gap="2"><Avatar size="1" radius="full" fallback={initials(d.driver)} color="indigo" /><Text size="2" weight="medium">{d.driver}</Text></Flex></Table.RowHeaderCell>
                    <Table.Cell align="right"><Text size="2">{d.deliveries}</Text></Table.Cell>
                    <Table.Cell align="right"><Text size="2" color="gray">{d.total}</Text></Table.Cell>
                    <Table.Cell align="right"><Badge color={slaColor(d.success)} variant="soft" radius="full">{d.success} %</Badge></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="merchants">
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Marchand</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Livraisons</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Taux de réussite</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">COD généré</Table.ColumnHeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {byMerchant.length === 0 && <Table.Row><Table.Cell colSpan={4}><Text size="2" color="gray">Aucune donnée.</Text></Table.Cell></Table.Row>}
                {byMerchant.map((m) => (
                  <Table.Row key={m.merchant} align="center">
                    <Table.RowHeaderCell><Text size="2" weight="medium">{m.merchant}</Text></Table.RowHeaderCell>
                    <Table.Cell align="right"><Text size="2">{m.deliveries}</Text></Table.Cell>
                    <Table.Cell><Flex align="center" gap="2" style={{ minWidth: 140 }}><Box style={{ flex: 1 }}><Progress value={m.success} color={slaColor(m.success)} /></Box><Badge color={slaColor(m.success)} variant="soft" radius="full">{m.success} %</Badge></Flex></Table.Cell>
                    <Table.Cell align="right"><Text size="2" weight="medium">{money(m.revenue)}</Text></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        </Tabs.Content>
      </Box>
    </Tabs.Root>
  );
}
