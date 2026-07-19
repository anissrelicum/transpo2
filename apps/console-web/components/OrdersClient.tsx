'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Text, Table, Badge, Button, IconButton, TextField, Select,
  Avatar, Checkbox, Code, DropdownMenu, Callout,
} from '@radix-ui/themes';
import {
  MagnifyingGlassIcon, Cross2Icon, ChevronLeftIcon, ChevronRightIcon, DotsHorizontalIcon,
  EyeOpenIcon, PersonIcon, PauseIcon, ArchiveIcon,
} from '@radix-ui/react-icons';
import { StatusBadge, CodChip } from '@transpo/ui-web';
import { STATUS_META } from '@transpo/domain';
import type { Order, OrderStatus } from '@transpo/domain';

const STATUSES: OrderStatus[] = ['NOUVELLE', 'ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON', 'LIVREE', 'ECHOUEE', 'RETOUR', 'ANNULEE', 'PROGRAMMEE'];
const TERMINAL = ['LIVREE', 'ANNULEE', 'RETOUR', 'ECHOUEE', 'RENDU'];
const PER = 8;
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

export function OrdersClient({ orders, drivers, cities, merchants, canWrite, initialQuery }: {
  orders: Order[]; drivers: string[]; cities: string[]; merchants: string[];
  canWrite: boolean; initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery ?? '');
  const [statusF, setStatusF] = React.useState('__all');
  const [cityF, setCityF] = React.useState('__all');
  const [merchF, setMerchF] = React.useState('__all');
  const [driverF, setDriverF] = React.useState('__all');
  const [page, setPage] = React.useState(1);
  const [sel, setSel] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { setPage(1); }, [query, statusF, cityF, merchF, driverF]);

  const q = query.trim().toLowerCase();
  const all = orders.filter((o) => {
    if (statusF !== '__all' && o.status !== statusF) return false;
    if (cityF !== '__all' && o.fromCity !== cityF && o.toCity !== cityF) return false;
    if (merchF !== '__all' && o.merchant !== merchF) return false;
    if (driverF !== '__all' && o.driver !== driverF) return false;
    if (!q) return true;
    return `${o.ref} ${o.code} ${o.merchant ?? ''} ${o.driver ?? ''} ${o.fromCity} ${o.toCity}`.toLowerCase().includes(q);
  });
  const pageCount = Math.max(1, Math.ceil(all.length / PER));
  const cur = Math.min(page, pageCount);
  const rows = all.slice((cur - 1) * PER, cur * PER);
  const toggle = (ref: string) => setSel((s) => s.includes(ref) ? s.filter((x) => x !== ref) : [...s, ref]);

  async function post(url: string, body?: any) {
    setBusy(true);
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    setBusy(false);
    if (res.ok) router.refresh(); else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
  }
  const act = (ref: string, action: string, body?: any) => post(`/api/orders/${encodeURIComponent(ref)}/${action}`, body);
  const firstDriver = drivers[0];
  async function bulkAssign() { for (const r of sel) await act(r, 'assign', { driver: firstDriver }); setSel([]); }
  async function bulkHold() { for (const r of sel) await act(r, 'advance'); setSel([]); }

  const reset = () => { setQuery(''); setStatusF('__all'); setCityF('__all'); setMerchF('__all'); setDriverF('__all'); };

  return (
    <>
      {/* Carte de filtres */}
      <Card size="2" mb="3">
        <Flex gap="2" wrap="wrap" align="center">
          <Box style={{ flex: 1, minWidth: 220 }}>
            <TextField.Root size="2" radius="large" placeholder="Réf, code, marchand, ville…" value={query} onChange={(e) => setQuery(e.target.value)}>
              <TextField.Slot><MagnifyingGlassIcon height="15" width="15" /></TextField.Slot>
              {query && <TextField.Slot side="right"><IconButton size="1" variant="ghost" color="gray" onClick={() => setQuery('')}><Cross2Icon /></IconButton></TextField.Slot>}
            </TextField.Root>
          </Box>
          <Select.Root value={statusF} onValueChange={setStatusF} size="2">
            <Select.Trigger variant="soft" color="gray" placeholder="Statut" />
            <Select.Content>
              <Select.Item value="__all">Statut : Tous</Select.Item>
              <Select.Separator />
              {STATUSES.map((k) => <Select.Item key={k} value={k}>{STATUS_META[k].fr}</Select.Item>)}
            </Select.Content>
          </Select.Root>
          <FilterSelect label="Ville" options={cities} value={cityF} onChange={setCityF} />
          <FilterSelect label="Marchand" options={merchants} value={merchF} onChange={setMerchF} />
          <FilterSelect label="Livreur" options={drivers} value={driverF} onChange={setDriverF} />
          <Button variant="ghost" color="gray" size="2" onClick={reset}>Réinitialiser</Button>
        </Flex>
      </Card>

      {all.length === 0 ? (
        <Card size="3">
          <Flex direction="column" align="center" justify="center" gap="3" py="9" style={{ textAlign: 'center' }}>
            <Flex align="center" justify="center" style={{ width: 48, height: 48, borderRadius: 'var(--radius-4)', background: 'var(--gray-a3)', color: 'var(--gray-9)' }}><ArchiveIcon width="22" /></Flex>
            <Text size="3" weight="bold">Aucune commande</Text>
            <Text size="2" color="gray">Aucune commande ne correspond à ces filtres.</Text>
          </Flex>
        </Card>
      ) : (
        <Card size="1">
          {canWrite && sel.length > 0 && (
            <Flex align="center" justify="between" px="3" py="2" style={{ background: 'var(--indigo-a3)', borderRadius: 'var(--radius-2)', margin: 'var(--space-1)' }}>
              <Text size="2" weight="medium">{sel.length} sélectionnée(s)</Text>
              <Flex gap="2">
                <Button size="1" variant="soft" disabled={busy || !firstDriver} onClick={bulkAssign}><PersonIcon /> Assigner</Button>
                <Button size="1" variant="soft" color="gray" disabled={busy} onClick={bulkHold}><PauseIcon /> Faire avancer</Button>
              </Flex>
            </Flex>
          )}
          <Table.Root size="1" variant="ghost">
            <Table.Header>
              <Table.Row>
                {canWrite && <Table.ColumnHeaderCell style={{ width: 36 }}><Checkbox checked={sel.length === rows.length && rows.length > 0} onCheckedChange={(c) => setSel(c ? rows.map((o) => o.ref) : [])} /></Table.ColumnHeaderCell>}
                <Table.ColumnHeaderCell>Référence</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Marchand</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Trajet</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Livreur</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">COD</Table.ColumnHeaderCell>
                {canWrite && <Table.ColumnHeaderCell style={{ width: 44 }}></Table.ColumnHeaderCell>}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((o) => (
                <Table.Row key={o.ref} align="center" data-testid="order-row" style={{ background: sel.includes(o.ref) ? 'var(--indigo-a2)' : undefined }}>
                  {canWrite && <Table.Cell><Checkbox checked={sel.includes(o.ref)} onCheckedChange={() => toggle(o.ref)} /></Table.Cell>}
                  <Table.RowHeaderCell>
                    <Link href={`/orders/${encodeURIComponent(o.ref)}`} style={{ whiteSpace: 'nowrap', color: 'var(--indigo-11)', fontWeight: 500 }}>{o.ref}</Link>
                    <Text as="div" size="1" color="gray"><Code variant="ghost" size="1">{o.code}</Code></Text>
                  </Table.RowHeaderCell>
                  <Table.Cell><Text size="2">{o.merchant}</Text></Table.Cell>
                  <Table.Cell><Text size="2" color="gray">{o.fromCity} → {o.toCity}</Text></Table.Cell>
                  <Table.Cell><StatusBadge status={o.status} /></Table.Cell>
                  <Table.Cell>{o.driver ? <Flex align="center" gap="1"><Avatar size="1" radius="full" fallback={initials(o.driver)} color="gray" /><Text size="2">{o.driver}</Text></Flex> : <Badge color="blue" variant="surface">— à affecter</Badge>}</Table.Cell>
                  <Table.Cell align="right"><CodChip amount={o.cod} paid={o.codPaid} /></Table.Cell>
                  {canWrite && (
                    <Table.Cell>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger><IconButton size="1" variant="ghost" color="gray" disabled={busy}><DotsHorizontalIcon /></IconButton></DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item asChild><Link href={`/orders/${encodeURIComponent(o.ref)}`}><EyeOpenIcon /> Voir le détail</Link></DropdownMenu.Item>
                          <DropdownMenu.Sub>
                            <DropdownMenu.SubTrigger disabled={TERMINAL.includes(o.status)}>Assigner un livreur</DropdownMenu.SubTrigger>
                            <DropdownMenu.SubContent>
                              {drivers.length === 0 && <DropdownMenu.Item disabled>Aucun livreur</DropdownMenu.Item>}
                              {drivers.map((d) => <DropdownMenu.Item key={d} onSelect={() => act(o.ref, 'assign', { driver: d })}>{d === o.driver ? `✓ ${d}` : d}</DropdownMenu.Item>)}
                            </DropdownMenu.SubContent>
                          </DropdownMenu.Sub>
                          <DropdownMenu.Item disabled={TERMINAL.includes(o.status) || o.status === 'LIVRAISON'} onSelect={() => act(o.ref, 'advance')}>Faire progresser</DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item color="red" disabled={TERMINAL.includes(o.status)} onSelect={() => act(o.ref, 'cancel')}><Cross2Icon /> Annuler</DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </Table.Cell>
                  )}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          <Flex align="center" justify="between" px="3" py="2" style={{ borderTop: '1px solid var(--gray-a4)' }} data-testid="pagination">
            <Text size="1" color="gray" data-testid="orders-count">{all.length} résultat(s)</Text>
            <Flex gap="2" align="center">
              <IconButton size="1" variant="soft" color="gray" disabled={cur <= 1} onClick={() => setPage(cur - 1)}><ChevronLeftIcon /></IconButton>
              {Array.from({ length: pageCount }).slice(0, 5).map((_, i) => {
                const p = i + 1;
                return <Button key={p} size="1" variant={p === cur ? 'soft' : 'ghost'} color={p === cur ? 'indigo' : 'gray'} onClick={() => setPage(p)}>{p}</Button>;
              })}
              {pageCount > 5 && <Text size="1" color="gray">… {pageCount}</Text>}
              <IconButton size="1" variant="soft" color="gray" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)}><ChevronRightIcon /></IconButton>
            </Flex>
          </Flex>
        </Card>
      )}
    </>
  );
}

function FilterSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select.Root value={value} onValueChange={onChange} size="2">
      <Select.Trigger variant="soft" color="gray" placeholder={label} />
      <Select.Content>
        <Select.Item value="__all">{label} : Tous</Select.Item>
        <Select.Separator />
        {options.map((o) => <Select.Item key={o} value={o}>{o}</Select.Item>)}
      </Select.Content>
    </Select.Root>
  );
}
