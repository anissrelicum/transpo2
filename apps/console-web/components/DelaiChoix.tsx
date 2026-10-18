'use client';
// Choix d'un délai de livraison (ADR 0006) : défaut d'un marchand ou délai d'une commande.
import * as React from 'react';
import { Box, Flex, Grid, Select, Text, TextField } from '@radix-ui/themes';
import { DELAY_LABELS, describeDelay, validateDelayPolicy, type DelayMode, type DelayPolicy } from '@transpo/domain';

const AIDES: Record<DelayMode, string> = {
  aucun: 'Colis du jour : le livreur organise sa tournée librement.',
  apres_retrait: 'Restaurant, plats : le compte à rebours démarre quand le livreur récupère la commande.',
  apres_commande: 'Course express : l’échéance court dès la commande, attente du livreur comprise.',
  heure_limite: 'Documents, rendez-vous : à livrer avant une heure précise (le lendemain si elle est passée).',
};

/** Règle saisie → règle valide, ou message d'erreur. */
export function lireDelai(p: DelayPolicy): { ok: true; policy: DelayPolicy } | { ok: false; error: string } {
  const err = validateDelayPolicy(p);
  return err ? { ok: false, error: err } : { ok: true, policy: p };
}

export function DelaiChoix({ value, onChange, disabled, testId }: {
  value: DelayPolicy; onChange: (p: DelayPolicy) => void; disabled?: boolean; testId?: string;
}) {
  const set = (patch: Partial<DelayPolicy>) => onChange({ ...value, ...patch });
  const nombre = (v: string) => (v.trim() === '' ? null : Math.round(Number(v)));
  return (
    <Flex direction="column" gap="2" data-testid={testId}>
      <Select.Root value={value.mode} disabled={disabled}
        onValueChange={(m) => onChange({
          mode: m as DelayMode,
          minutes: m === 'apres_retrait' ? value.minutes ?? 30 : m === 'apres_commande' ? value.minutes ?? 60 : null,
          heure: m === 'heure_limite' ? value.heure ?? '12:00' : null,
          retraitMinutes: value.retraitMinutes ?? null,
        })}>
        <Select.Trigger aria-label="Type de délai" />
        <Select.Content>
          {(Object.keys(DELAY_LABELS) as DelayMode[]).map((m) => <Select.Item key={m} value={m}>{DELAY_LABELS[m].fr}</Select.Item>)}
        </Select.Content>
      </Select.Root>
      <Text size="1" color="gray">{AIDES[value.mode]}</Text>
      <Grid columns={{ initial: '1', sm: '2' }} gap="3">
        {(value.mode === 'apres_retrait' || value.mode === 'apres_commande') && (
          <Box><Text as="label" size="2" weight="medium">À livrer en (minutes)
            <TextField.Root mt="1" type="number" min={5} max={1440} value={value.minutes ?? ''} disabled={disabled}
              onChange={(e) => set({ minutes: nombre(e.target.value) })} />
          </Text></Box>
        )}
        {value.mode === 'heure_limite' && (
          <Box><Text as="label" size="2" weight="medium">À livrer avant
            <TextField.Root mt="1" type="time" value={value.heure ?? ''} disabled={disabled}
              onChange={(e) => set({ heure: e.target.value || null })} />
          </Text></Box>
        )}
        {value.mode !== 'aucun' && (
          <Box><Text as="label" size="2" weight="medium">Retrait limite (min après la commande, facultatif)
            <TextField.Root mt="1" type="number" min={5} max={1440} placeholder="Ex. : 20" value={value.retraitMinutes ?? ''} disabled={disabled}
              onChange={(e) => set({ retraitMinutes: nombre(e.target.value) })} />
          </Text></Box>
        )}
      </Grid>
      {value.mode !== 'aucun' && <Text size="1" color="gray">Engagement : {describeDelay(value)}{value.retraitMinutes ? `, retrait sous ${value.retraitMinutes} min` : ''}.</Text>}
    </Flex>
  );
}
