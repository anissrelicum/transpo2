'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, Flex, Box, Grid, Text, Heading, Badge, Button, TextField, TextArea, Select, Callout } from '@radix-ui/themes';
import { CheckIcon, InfoCircledIcon, GlobeIcon } from '@radix-ui/react-icons';
import type { CompanySettings, PriceConfig } from '@transpo/api-client';
import { PageHeader } from './ui';

const CURRENCIES = ['MAD'];
const TIMEZONES = ['Africa/Casablanca'];
const LANGS: Array<{ value: 'fr' | 'ar'; label: string }> = [{ value: 'fr', label: 'Français' }, { value: 'ar', label: 'العربية' }];

function SaveButton({ busy, saved, onClick }: { busy: boolean; saved: boolean; onClick: () => void }) {
  return <Button size="2" disabled={busy} onClick={onClick}><CheckIcon /> {saved ? 'Enregistré ✓' : 'Enregistrer'}</Button>;
}

export function SettingsView({ tenant, company, pricing, isAdmin }: { tenant: string; company: CompanySettings; pricing: PriceConfig; isAdmin: boolean }) {
  const router = useRouter();

  const [identity, setIdentity] = React.useState({
    legalName: company.legalName ?? '', ice: company.ice ?? '', rc: company.rc ?? '', address: company.address ?? '',
  });
  const [regional, setRegional] = React.useState({
    currency: company.currency, timezone: company.timezone, defaultLang: company.defaultLang,
  });
  const [commissionPct, setCommissionPct] = React.useState(Math.round(pricing.commissionRate * 100));
  const [vatPct, setVatPct] = React.useState(Math.round(pricing.vatRate * 100));

  const [busyIdentity, setBusyIdentity] = React.useState(false);
  const [busyRegional, setBusyRegional] = React.useState(false);
  const [busyRates, setBusyRates] = React.useState(false);
  const [saved, setSaved] = React.useState<'identity' | 'regional' | 'rates' | null>(null);

  function flash(which: 'identity' | 'regional' | 'rates') {
    setSaved(which);
    router.refresh();
    setTimeout(() => setSaved((s) => (s === which ? null : s)), 2000);
  }

  async function saveCompany(setBusy: (b: boolean) => void, which: 'identity' | 'regional', body: Partial<CompanySettings>) {
    setBusy(true);
    const res = await fetch('/api/proxy/v1/settings/company', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...identity, ...regional, ...body }),
    });
    setBusy(false);
    if (res.ok) flash(which);
    else { const e = await res.json().catch(() => null); alert(e?.error ?? 'Enregistrement impossible'); }
  }

  async function saveRates() {
    setBusyRates(true);
    const res = await fetch('/api/proxy/v1/pricing/config', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tiers: pricing.tiers, fragileSurcharge: pricing.fragileSurcharge, scheduledSurcharge: pricing.scheduledSurcharge,
        discountRate: pricing.discountRate, commissionRate: Math.min(Math.max(commissionPct, 0), 100) / 100, vatRate: Math.min(Math.max(vatPct, 0), 100) / 100,
      }),
    });
    setBusyRates(false);
    if (res.ok) flash('rates');
    else { const e = await res.json().catch(() => null); alert(e?.error ?? 'Enregistrement impossible'); }
  }

  return (
    <>
      <PageHeader title="Paramètres" subtitle={`Organisation ${tenant} — identité, régional, tarification plateforme`} />

      {!isAdmin && (
        <Callout.Root color="gray" variant="surface" mb="4">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>Lecture seule — la modification des paramètres est réservée à l’administrateur.</Callout.Text>
        </Callout.Root>
      )}

      <Grid columns={{ initial: '1', md: '2' }} gap="4">
        <Card size="3">
          <Heading size="4" mb="3">Identité légale</Heading>
          <Flex direction="column" gap="3">
            <Box>
              <Text as="div" size="1" color="gray" mb="1">Raison sociale</Text>
              <TextField.Root disabled={!isAdmin} value={identity.legalName} onChange={(e) => setIdentity({ ...identity, legalName: e.target.value })} placeholder="Casa Express SARL" />
            </Box>
            <Grid columns="2" gap="3">
              <Box>
                <Text as="div" size="1" color="gray" mb="1">ICE</Text>
                <TextField.Root disabled={!isAdmin} value={identity.ice} onChange={(e) => setIdentity({ ...identity, ice: e.target.value })} placeholder="001234567000012" />
              </Box>
              <Box>
                <Text as="div" size="1" color="gray" mb="1">RC</Text>
                <TextField.Root disabled={!isAdmin} value={identity.rc} onChange={(e) => setIdentity({ ...identity, rc: e.target.value })} placeholder="123456" />
              </Box>
            </Grid>
            <Box>
              <Text as="div" size="1" color="gray" mb="1">Adresse</Text>
              <TextArea disabled={!isAdmin} value={identity.address} onChange={(e) => setIdentity({ ...identity, address: e.target.value })} placeholder="123 Bd Zerktouni, Casablanca" rows={2} />
            </Box>
          </Flex>
          {isAdmin && (
            <Flex justify="end" mt="4">
              <SaveButton busy={busyIdentity} saved={saved === 'identity'} onClick={() => saveCompany(setBusyIdentity, 'identity', identity)} />
            </Flex>
          )}
        </Card>

        <Card size="3">
          <Heading size="4" mb="3">Régional</Heading>
          <Flex direction="column" gap="3">
            <Box>
              <Text as="div" size="1" color="gray" mb="1">Organisation (tenant)</Text>
              <Badge color="indigo">{tenant}</Badge>
            </Box>
            <Box>
              <Text as="div" size="1" color="gray" mb="1">Devise</Text>
              <Select.Root disabled={!isAdmin} value={regional.currency} onValueChange={(v) => setRegional({ ...regional, currency: v })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>{CURRENCIES.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Box>
            <Box>
              <Text as="div" size="1" color="gray" mb="1">Fuseau horaire</Text>
              <Select.Root disabled={!isAdmin} value={regional.timezone} onValueChange={(v) => setRegional({ ...regional, timezone: v })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>{TIMEZONES.map((t) => <Select.Item key={t} value={t}>{t}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Box>
            <Box>
              <Text as="div" size="1" color="gray" mb="1">Langue par défaut</Text>
              <Select.Root disabled={!isAdmin} value={regional.defaultLang} onValueChange={(v) => setRegional({ ...regional, defaultLang: v as 'fr' | 'ar' })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>{LANGS.map((l) => <Select.Item key={l.value} value={l.value}>{l.label}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Box>
          </Flex>
          {isAdmin && (
            <Flex justify="end" mt="4">
              <SaveButton busy={busyRegional} saved={saved === 'regional'} onClick={() => saveCompany(setBusyRegional, 'regional', regional)} />
            </Flex>
          )}
        </Card>

        <Box style={{ gridColumn: '1 / -1' }}>
          <Card size="3">
            <Heading size="4" mb="1">Commission & TVA</Heading>
            <Text as="div" size="2" color="gray" mb="3">Pilote la facturation marchand, le reversement COD et la cascade tarifaire (Tarification) dans toute la console.</Text>
            <Grid columns={{ initial: '2', sm: '4' }} gap="3" align="end">
              <Box>
                <Text as="div" size="1" color="gray" mb="1">Commission plateforme</Text>
                <TextField.Root disabled={!isAdmin} type="number" value={String(commissionPct)} onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}>
                  <TextField.Slot side="right"><Text size="1" color="gray">%</Text></TextField.Slot>
                </TextField.Root>
              </Box>
              <Box>
                <Text as="div" size="1" color="gray" mb="1">TVA</Text>
                <TextField.Root disabled={!isAdmin} type="number" value={String(vatPct)} onChange={(e) => setVatPct(Number(e.target.value) || 0)}>
                  <TextField.Slot side="right"><Text size="1" color="gray">%</Text></TextField.Slot>
                </TextField.Root>
              </Box>
              {isAdmin && (
                <Box style={{ gridColumn: 'span 2' }}>
                  <Flex justify="end"><SaveButton busy={busyRates} saved={saved === 'rates'} onClick={saveRates} /></Flex>
                </Box>
              )}
            </Grid>
          </Card>
        </Box>

        <Box style={{ gridColumn: '1 / -1' }}>
          <Card size="2" variant="surface">
            <Flex align="center" gap="3">
              <GlobeIcon />
              <Text size="2" color="gray">Thème clair/sombre : bascule dans la barre du haut. Langues console : FR / AR (RTL).</Text>
            </Flex>
          </Card>
        </Box>
      </Grid>
    </>
  );
}
