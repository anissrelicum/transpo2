'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, Table, Callout, Separator,
  TextField, Switch, Slider,
} from '@radix-ui/themes';
import {
  InfoCircledIcon, PlusIcon, TrashIcon, CheckIcon, DownloadIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import type { PriceConfig, PriceTier } from '@transpo/api-client';
import { PageHeader } from './ui';

const round2 = (n: number) => Math.round(n * 100) / 100;
function gridFor(d: number, tiers: PriceTier[]): number {
  const t = tiers.find((x) => (x.to == null ? d >= x.from : d >= x.from && d < x.to)) ?? tiers[0];
  if (!t) return 0;
  return t.perKm != null ? Math.round(t.perKm * d) : (t.base ?? 0);
}

export function PricingView({ config }: { config: PriceConfig }) {
  const router = useRouter();
  const [tiers, setTiers] = React.useState<PriceTier[]>(config.tiers);
  const [fragile, setFragile] = React.useState(config.fragileSurcharge);
  const [scheduled, setScheduled] = React.useState(config.scheduledSurcharge);
  const [discountRate, setDiscountRate] = React.useState(config.discountRate);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Simulateur
  const [dist, setDist] = React.useState([9]);
  const [useFixed, setUseFixed] = React.useState(false);
  const [useDiscount, setUseDiscount] = React.useState(true);
  const [fixedPrice, setFixedPrice] = React.useState(90);
  const d = dist[0];

  const grid = gridFor(d, tiers);
  const afterDiscount = round2(grid * (1 - discountRate));
  const applied = useFixed
    ? { rank: 1, label: 'Prix fixe marchand', value: fixedPrice }
    : useDiscount
      ? { rank: 2, label: `Grille remisée −${Math.round(discountRate * 100)} %`, value: afterDiscount }
      : { rank: 3, label: 'Grille standard', value: grid };
  const ht = round2(applied.value);
  const tva = round2(ht * 0.2);
  const ttc = round2(ht + tva);

  const setTierField = (i: number, field: keyof PriceTier, val: string) =>
    setTiers((ts) => ts.map((tr, j) => {
      if (j !== i) return tr;
      if (field === 'to') return { ...tr, to: val === '' || val === '∞' ? null : Number(val) || 0 };
      return { ...tr, [field]: Number(val) || 0 };
    }));
  const addTier = () => setTiers((ts) => {
    const last = ts[ts.length - 1];
    const from = last.to == null ? last.from + 5 : last.to;
    const head = ts.slice(0, -1);
    return [...head, { from: last.from, to: from, base: last.base ?? Math.round((last.perKm ?? 3) * from) }, { from, to: null, perKm: last.perKm ?? 3 }];
  });
  const removeTier = (i: number) => setTiers((ts) => (ts.length > 1 ? ts.filter((_, j) => j !== i) : ts));

  async function save() {
    setBusy(true);
    const res = await fetch('/api/proxy/v1/pricing/config', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tiers, fragileSurcharge: fragile, scheduledSurcharge: scheduled, discountRate }),
    });
    setBusy(false);
    if (res.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 2500); }
    else { const e = await res.json().catch(() => null); alert(e?.error ?? 'Enregistrement impossible'); }
  }

  function exportCsv() {
    const head = ['De (km)', 'À (km)', 'Tarif'];
    const lines = tiers.map((t) => [t.from, t.to ?? '∞', t.perKm != null ? `${t.perKm} DH/km` : `${t.base} DH`].join(';'));
    const url = URL.createObjectURL(new Blob([[head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'grille-tarifaire.csv'; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Tarification"
        subtitle="Grille par palier de distance, suppléments et remise — appliqués aux devis"
        actions={
          <Flex gap="2">
            <Button variant="soft" color="gray" onClick={exportCsv}><DownloadIcon /> Export grille</Button>
            <Button disabled={busy} onClick={save}><CheckIcon /> {saved ? 'Enregistré ✓' : 'Enregistrer'}</Button>
          </Flex>
        }
      />

      <Callout.Root color="indigo" variant="surface" mb="4">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>
          Cascade tarifaire à priorité stricte : <strong>① prix fixe marchand</strong> → <strong>② grille remisée</strong> → <strong>③ grille standard</strong>. Le premier niveau applicable l’emporte ; suppléments et TVA 20 % ajoutés ensuite.
        </Callout.Text>
      </Callout.Root>

      <Grid columns={{ initial: '1', md: '5' }} gap="4">
        {/* Grille éditable */}
        <Box style={{ gridColumn: 'span 3' }}>
          <Card size="3">
            <Flex justify="between" align="center" mb="3">
              <Heading size="4">Grille par distance</Heading>
              <Button size="1" variant="soft" onClick={addTier}><PlusIcon /> Palier</Button>
            </Flex>
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>De (km)</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>À (km)</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Tarif</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell />
              </Table.Row></Table.Header>
              <Table.Body>
                {tiers.map((tr, i) => {
                  const active = tr.to == null ? d >= tr.from : d >= tr.from && d < tr.to;
                  return (
                    <Table.Row key={i} style={{ background: active ? 'var(--indigo-a2)' : undefined }}>
                      <Table.Cell>
                        <TextField.Root size="1" type="number" value={String(tr.from)} onChange={(e) => setTierField(i, 'from', e.target.value)} style={{ width: 68 }} />
                      </Table.Cell>
                      <Table.Cell>
                        <TextField.Root size="1" value={tr.to == null ? '∞' : String(tr.to)} onChange={(e) => setTierField(i, 'to', e.target.value)} style={{ width: 68 }} />
                      </Table.Cell>
                      <Table.Cell>
                        {tr.perKm != null ? (
                          <Flex align="center" gap="1">
                            <TextField.Root size="1" type="number" value={String(tr.perKm)} onChange={(e) => setTierField(i, 'perKm', e.target.value)} style={{ width: 70 }} />
                            <Text size="1" color="gray">DH/km</Text>
                          </Flex>
                        ) : (
                          <Flex align="center" gap="1">
                            <TextField.Root size="1" type="number" value={String(tr.base ?? 0)} onChange={(e) => setTierField(i, 'base', e.target.value)} style={{ width: 70 }} />
                            <Text size="1" color="gray">DH</Text>
                          </Flex>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <IconButton size="1" variant="ghost" color="red" onClick={() => removeTier(i)} disabled={tiers.length <= 1}><TrashIcon /></IconButton>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>

            <Separator size="4" my="3" />
            <Grid columns="3" gap="3">
              <Box>
                <Text as="div" size="1" color="gray" mb="1">Supplément fragile</Text>
                <TextField.Root size="2" type="number" value={String(fragile)} onChange={(e) => setFragile(Number(e.target.value) || 0)}>
                  <TextField.Slot side="right"><Text size="1" color="gray">DH</Text></TextField.Slot>
                </TextField.Root>
              </Box>
              <Box>
                <Text as="div" size="1" color="gray" mb="1">Supplément programmé</Text>
                <TextField.Root size="2" type="number" value={String(scheduled)} onChange={(e) => setScheduled(Number(e.target.value) || 0)}>
                  <TextField.Slot side="right"><Text size="1" color="gray">DH</Text></TextField.Slot>
                </TextField.Root>
              </Box>
              <Box>
                <Text as="div" size="1" color="gray" mb="1">Remise standard</Text>
                <TextField.Root size="2" type="number" value={String(Math.round(discountRate * 100))} onChange={(e) => setDiscountRate((Number(e.target.value) || 0) / 100)}>
                  <TextField.Slot side="right"><Text size="1" color="gray">%</Text></TextField.Slot>
                </TextField.Root>
              </Box>
            </Grid>
          </Card>
        </Box>

        {/* Simulateur */}
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="3" style={{ position: 'sticky', top: 16 }}>
            <Heading size="4" mb="3">Simulateur de devis</Heading>
            <Text as="div" size="2" color="gray" mb="1">Distance : {d} km</Text>
            <Slider value={dist} onValueChange={setDist} min={1} max={40} step={1} />
            <Flex direction="column" gap="2" mt="3">
              <Flex align="center" justify="between"><Text size="2" color="gray">Prix fixe marchand</Text><Switch checked={useFixed} onCheckedChange={setUseFixed} /></Flex>
              {useFixed && (
                <TextField.Root size="1" type="number" value={String(fixedPrice)} onChange={(e) => setFixedPrice(Number(e.target.value) || 0)}>
                  <TextField.Slot side="right"><Text size="1" color="gray">DH</Text></TextField.Slot>
                </TextField.Root>
              )}
              <Flex align="center" justify="between"><Text size="2" color="gray">Remise contractuelle −{Math.round(discountRate * 100)} %</Text><Switch checked={useDiscount} onCheckedChange={setUseDiscount} disabled={useFixed} /></Flex>
            </Flex>
            <Separator size="4" my="3" />
            <Flex direction="column" gap="2">
              <PrRow rank={1} active={applied.rank === 1} label="① Prix fixe marchand" value={useFixed ? money(fixedPrice) : '—'} />
              <PrRow rank={2} active={applied.rank === 2} label="② Grille remisée" value={useDiscount && !useFixed ? money(afterDiscount) : '—'} />
              <PrRow rank={3} active={applied.rank === 3} label="③ Grille standard" value={money(grid)} />
            </Flex>
            <Separator size="4" my="3" />
            <Flex direction="column" gap="1">
              <Flex justify="between"><Text size="2" color="gray">Base ({applied.label})</Text><Text size="2">{money(applied.value)}</Text></Flex>
              <Flex justify="between"><Text size="2" color="gray">TVA 20 %</Text><Text size="2" color="gray">{money(tva)}</Text></Flex>
            </Flex>
            <Separator size="4" my="3" />
            <Flex justify="between" align="center">
              <Text size="3" weight="bold">Total TTC</Text>
              <Heading size="7" color="indigo" style={{ whiteSpace: 'nowrap' }}>{money(ttc)}</Heading>
            </Flex>
          </Card>
        </Box>
      </Grid>
    </>
  );
}

function PrRow({ rank, active, label, value }: { rank: number; active: boolean; label: string; value: string }) {
  return (
    <Flex align="center" justify="between" p="2" style={{
      borderRadius: 'var(--radius-2)',
      background: active ? 'var(--indigo-a3)' : 'transparent',
      border: active ? '1px solid var(--indigo-a6)' : '1px solid var(--gray-a3)',
    }}>
      <Flex align="center" gap="2">
        {active && <CheckIcon color="var(--indigo-11)" />}
        <Text size="2" weight={active ? 'medium' : 'regular'} color={active ? undefined : 'gray'}>{label}</Text>
      </Flex>
      <Text size="2" weight={active ? 'bold' : 'regular'} color={active ? 'indigo' : 'gray'}>{value}</Text>
    </Flex>
  );
}
