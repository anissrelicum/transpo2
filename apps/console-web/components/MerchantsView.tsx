'use client';
import * as React from 'react';
import type { DelayPolicy } from '@transpo/domain';
import { DelaiChoix, lireDelai } from './DelaiChoix';
import { useSafeRefresh } from '../lib/safe-refresh';
import {
  Card, Flex, Box, Grid, Text, Badge, Button, Table, Callout, Dialog, Separator,
  SegmentedControl, Switch, TextField, TextField as TF,
} from '@radix-ui/themes';
import {
  PlusIcon, Pencil1Icon, MagnifyingGlassIcon, InfoCircledIcon, PersonIcon, TokensIcon, BackpackIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import type { MerchantRecord, MerchantInput, PricingMode, QuoteResult } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const EXEMPLES_KM = [3, 15, 40];
const pct = (r: number | null | undefined) => (r == null ? '' : String(Math.round(r * 1000) / 10));

/** Badge des conditions : ce que l'exploitant doit lire d'un coup d'œil dans la liste. */
export function ConditionsBadge({ m }: { m: Pick<MerchantRecord, 'mode' | 'discountRate' | 'flatPrice'> }) {
  if (m.mode === 'forfait') return <Badge color="amber" variant="soft">Forfait {money(m.flatPrice ?? 0)}</Badge>;
  if (m.mode === 'remise') return <Badge color="indigo" variant="soft">Grille −{pct(m.discountRate)} %</Badge>;
  return <Badge color="gray" variant="soft">Grille standard</Badge>;
}

export function MerchantsView({ merchants, companyCommission, canEdit }: {
  merchants: MerchantRecord[]; companyCommission: number; canEdit: boolean;
}) {
  const refresh = useSafeRefresh();
  const [q, setQ] = React.useState('');
  const [edition, setEdition] = React.useState<MerchantRecord | 'nouveau' | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const rows = merchants.filter((m) =>
    !q || `${m.name} ${m.legalName ?? ''} ${m.contactName ?? ''} ${m.email ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const forfaits = merchants.filter((m) => m.mode === 'forfait').length;
  const remises = merchants.filter((m) => m.mode === 'remise').length;
  const commissionsNegociees = merchants.filter((m) => m.commissionRate != null).length;

  return (
    <>
      <PageHeader
        title="Marchands"
        subtitle={`${merchants.length} marchand(s) · conditions tarifaires et commission négociées par client`}
        actions={canEdit ? <Button onClick={() => setEdition('nouveau')}><PlusIcon /> Nouveau marchand</Button> : undefined}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Marchands" value={String(merchants.length)} delta={`${merchants.filter((m) => m.active).length} actif(s)`} deltaColor="green" icon={<BackpackIcon width="15" />} accent="indigo" />
        <KPI label="Au forfait" value={String(forfaits)} delta="prix fixe par livraison" deltaColor="gray" icon={<TokensIcon width="15" />} accent="amber" />
        <KPI label="Grille remisée" value={String(remises)} delta="remise sur la grille" deltaColor="gray" icon={<TokensIcon width="15" />} accent="indigo" />
        <KPI label="Commission négociée" value={String(commissionsNegociees)} delta={`défaut : ${pct(companyCommission)} %`} deltaColor="gray" icon={<PersonIcon width="15" />} accent="cyan" />
      </Grid>

      {notice && (
        <Callout.Root color="green" mb="3" role="status"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>{notice}</Callout.Text></Callout.Root>
      )}

      <Flex gap="3" mb="3" wrap="wrap">
        <TF.Root placeholder="Rechercher un marchand…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }}>
          <TF.Slot><MagnifyingGlassIcon /></TF.Slot>
        </TF.Root>
      </Flex>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Marchand</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Conditions tarifaires</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Commission COD</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Comptes portail</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((m) => (
              <Table.Row key={m.id} align="center">
                <Table.RowHeaderCell>
                  <Text as="div" size="2" weight="medium">{m.name}</Text>
                  <Text as="div" size="1" color="gray">{[m.legalName, m.contactName, m.phone].filter(Boolean).join(' · ') || '—'}</Text>
                </Table.RowHeaderCell>
                <Table.Cell><ConditionsBadge m={m} /></Table.Cell>
                <Table.Cell>
                  <Text size="2">{pct(m.effectiveCommissionRate)} %</Text>{' '}
                  <Text size="1" color="gray">{m.commissionRate == null ? '(défaut)' : '(négociée)'}</Text>
                </Table.Cell>
                <Table.Cell><Text size="2">{m.accounts.length}</Text></Table.Cell>
                <Table.Cell><Badge color={m.active ? 'green' : 'gray'} variant="soft">{m.active ? 'Actif' : 'Désactivé'}</Badge></Table.Cell>
                <Table.Cell>
                  <Button size="1" variant="soft" onClick={() => setEdition(m)} aria-label={`${canEdit ? 'Modifier' : 'Voir'} ${m.name}`}>
                    <Pencil1Icon /> {canEdit ? 'Modifier' : 'Voir'}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
            {rows.length === 0 && (
              <Table.Row><Table.Cell colSpan={6}><Text size="2" color="gray">Aucun marchand{q ? ' ne correspond à la recherche' : ''}.</Text></Table.Cell></Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Card>

      {edition && (
        <FicheMarchand
          fiche={edition === 'nouveau' ? null : edition}
          companyCommission={companyCommission}
          canEdit={canEdit}
          onClose={() => setEdition(null)}
          onSaved={(nom, cree) => { setEdition(null); setNotice(cree ? `Marchand « ${nom} » créé.` : `Conditions de « ${nom} » enregistrées.`); refresh(); }}
        />
      )}
    </>
  );
}

function FicheMarchand({ fiche, companyCommission, canEdit, onClose, onSaved }: {
  fiche: MerchantRecord | null; companyCommission: number; canEdit: boolean;
  onClose: () => void; onSaved: (nom: string, cree: boolean) => void;
}) {
  const [name, setName] = React.useState(fiche?.name ?? '');
  const [legalName, setLegalName] = React.useState(fiche?.legalName ?? '');
  const [contactName, setContactName] = React.useState(fiche?.contactName ?? '');
  const [email, setEmail] = React.useState(fiche?.email ?? '');
  const [phone, setPhone] = React.useState(fiche?.phone ?? '');
  const [address, setAddress] = React.useState(fiche?.address ?? '');
  const [taxId, setTaxId] = React.useState(fiche?.taxId ?? '');
  const [mode, setMode] = React.useState<PricingMode>(fiche?.mode ?? 'standard');
  const [remise, setRemise] = React.useState(pct(fiche?.discountRate));
  const [forfait, setForfait] = React.useState(fiche?.flatPrice != null ? String(fiche.flatPrice) : '');
  const [commission, setCommission] = React.useState(pct(fiche?.commissionRate));
  const [active, setActive] = React.useState(fiche?.active ?? true);
  // Délai par défaut, suppléments express (DH HT) et pénalité de retard (cf. ADR 0006).
  const termes = fiche?.deliveryTerms;
  const [delai, setDelai] = React.useState<DelayPolicy>(termes?.delai ?? { mode: 'aucun' });
  const [supplements, setSupplements] = React.useState<Record<string, string>>({
    apres_retrait: termes?.supplements?.apres_retrait != null ? String(termes.supplements.apres_retrait) : '',
    apres_commande: termes?.supplements?.apres_commande != null ? String(termes.supplements.apres_commande) : '',
    heure_limite: termes?.supplements?.heure_limite != null ? String(termes.supplements.heure_limite) : '',
  });
  const [penalite, setPenalite] = React.useState(pct(termes?.penaliteRetard || null));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exemples, setExemples] = React.useState<{ km: number; ttc: number; ht: number }[] | null>(null);

  // Conditions telles que saisies (fractions) ; `null` si incomplètes.
  const conditions = React.useMemo(() => {
    if (mode === 'remise') {
      const r = Number(remise.replace(',', '.')) / 100;
      return r > 0 && r < 1 ? { mode, discountRate: r, flatPrice: null } : null;
    }
    if (mode === 'forfait') {
      const f = Number(forfait.replace(',', '.'));
      return f > 0 ? { mode, discountRate: null, flatPrice: f } : null;
    }
    return { mode, discountRate: null, flatPrice: null };
  }, [mode, remise, forfait]);

  // Exemples de prix en direct : l'effet des conditions se voit avant d'enregistrer.
  React.useEffect(() => {
    if (!conditions) { setExemples(null); return; }
    let annule = false;
    Promise.all(EXEMPLES_KM.map((km) => fetch('/api/proxy/v1/pricing/quote', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ distanceKm: km, conditions }),
    }).then((r) => (r.ok ? r.json() as Promise<QuoteResult> : null)).then((qr) => (qr ? { km, ht: qr.ht, ttc: qr.ttc } : null))))
      .then((xs) => { if (!annule) setExemples(xs.every(Boolean) ? (xs as { km: number; ht: number; ttc: number }[]) : null); })
      .catch(() => { if (!annule) setExemples(null); });
    return () => { annule = true; };
  }, [conditions]);

  async function enregistrer() {
    setError(null);
    if (!fiche && !name.trim()) { setError('Le nom du marchand est requis.'); return; }
    if (!conditions) { setError(mode === 'forfait' ? 'Indiquez le montant du forfait.' : 'Indiquez une remise entre 0 et 100 %.'); return; }
    const c = commission.trim() === '' ? null : Number(commission.replace(',', '.')) / 100;
    if (c != null && (!Number.isFinite(c) || c < 0 || c > 1)) { setError('Commission : un taux entre 0 et 100 %.'); return; }
    const d = lireDelai(delai);
    if (!d.ok) { setError(d.error); return; }
    const pen = penalite.trim() === '' ? 0 : Number(penalite.replace(',', '.')) / 100;
    if (!Number.isFinite(pen) || pen < 0 || pen > 1) { setError('Pénalité de retard : un taux entre 0 et 100 %.'); return; }
    const sup = Object.fromEntries(Object.entries(supplements).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v.replace(',', '.'))]));
    const body: MerchantInput = {
      ...(fiche ? {} : { name: name.trim() }),
      legalName, contactName, email, phone, address, taxId,
      mode, discountRate: conditions.discountRate, flatPrice: conditions.flatPrice,
      commissionRate: c, active,
      deliveryTerms: { delai: d.policy, supplements: sup, penaliteRetard: pen },
    };
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/merchants${fiche ? `/${fiche.id}` : ''}`, {
      method: fiche ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) onSaved(fiche?.name ?? name.trim(), !fiche);
    else { const d = await res.json().catch(() => null); setError(d?.error ?? d?.message ?? 'Enregistrement impossible.'); }
  }

  const champ = (label: string, valeur: string, set: (v: string) => void, props: React.ComponentProps<typeof TextField.Root> = {}) => (
    <Box>
      <Text as="label" size="2" weight="medium">{label}
        <TextField.Root mt="1" value={valeur} onChange={(e) => set(e.target.value)} disabled={!canEdit} {...props} />
      </Text>
    </Box>
  );

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Content maxWidth="720px">
        <Dialog.Title>{fiche ? fiche.name : 'Nouveau marchand'}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Identité du client et conditions négociées : elles fixent le prix de chacune de ses commandes.
        </Dialog.Description>

        <Text as="div" size="2" weight="bold" mb="2">Identité</Text>
        <Grid columns={{ initial: '1', sm: '2' }} gap="3">
          {fiche
            ? <Box><Text as="div" size="2" weight="medium">Nom</Text><Text as="div" size="2" mt="1">{fiche.name}</Text>
                <Text as="div" size="1" color="gray">Non modifiable : il rattache ses commandes et ses comptes.</Text></Box>
            : champ('Nom du marchand *', name, setName, { placeholder: 'Ex. : Maison Argane' })}
          {champ('Raison sociale', legalName, setLegalName)}
          {champ('Contact', contactName, setContactName)}
          {champ('E-mail', email, setEmail, { type: 'email' })}
          {champ('Téléphone', phone, setPhone)}
          {champ('Identifiant fiscal', taxId, setTaxId)}
        </Grid>
        <Box mt="3">{champ('Adresse', address, setAddress)}</Box>

        <Separator size="4" my="4" />
        <Text as="div" size="2" weight="bold" mb="2">Conditions tarifaires</Text>
        <SegmentedControl.Root value={mode} onValueChange={(v) => setMode(v as PricingMode)} disabled={!canEdit} aria-label="Mode tarifaire">
          <SegmentedControl.Item value="standard">Grille standard</SegmentedControl.Item>
          <SegmentedControl.Item value="remise">Grille remisée</SegmentedControl.Item>
          <SegmentedControl.Item value="forfait">Forfait</SegmentedControl.Item>
        </SegmentedControl.Root>
        <Text as="p" size="1" color="gray" mt="2">
          {mode === 'standard' && 'Prix à la distance, selon la grille de l’entreprise (Tarification).'}
          {mode === 'remise' && 'La grille de l’entreprise, moins la remise négociée avec ce marchand.'}
          {mode === 'forfait' && 'Un montant fixe par livraison, quelle que soit la distance. Les suppléments fragile et programmé s’ajoutent.'}
        </Text>
        <Grid columns={{ initial: '1', sm: '2' }} gap="3" mt="3">
          {mode === 'remise' && champ('Remise (%)', remise, setRemise, { type: 'number', min: 0, max: 99, placeholder: 'Ex. : 10' })}
          {mode === 'forfait' && champ('Forfait par livraison (HT)', forfait, setForfait, { type: 'number', min: 0, placeholder: 'Ex. : 30' })}
          {champ('Commission COD (%)', commission, setCommission, { type: 'number', min: 0, max: 100, placeholder: `${pct(companyCommission)} (défaut de l’entreprise)` })}
        </Grid>

        <Card size="1" mt="3" variant="surface">
          <Text as="div" size="1" color="gray" mb="2">Exemples de prix TTC avec ces conditions</Text>
          <Flex gap="4" wrap="wrap">
            {EXEMPLES_KM.map((km, i) => (
              <Box key={km}>
                <Text as="div" size="1" color="gray">{km} km</Text>
                <Text as="div" size="3" weight="bold">{exemples?.[i] ? money(exemples[i]!.ttc) : '—'}</Text>
              </Box>
            ))}
          </Flex>
        </Card>

        <Separator size="4" my="4" />
        <Text as="div" size="2" weight="bold" mb="1">Délai de livraison</Text>
        <Text as="p" size="1" color="gray" mb="2">
          Le délai par défaut de ses commandes (modifiable à chaque commande). Une commande à rendre dans l’heure part au livreur le plus proche ;
          le dispatcher, le client et le marchand sont prévenus dès qu’un retard se dessine.
        </Text>
        <DelaiChoix value={delai} onChange={setDelai} disabled={!canEdit} testId="delai-marchand" />
        <Grid columns={{ initial: '1', sm: '4' }} gap="3" mt="3">
          {champ('Supplément après retrait (DH HT)', supplements.apres_retrait!, (v) => setSupplements((x) => ({ ...x, apres_retrait: v })), { type: 'number', min: 0, placeholder: '0' })}
          {champ('Supplément express (DH HT)', supplements.apres_commande!, (v) => setSupplements((x) => ({ ...x, apres_commande: v })), { type: 'number', min: 0, placeholder: '0' })}
          {champ('Supplément heure limite (DH HT)', supplements.heure_limite!, (v) => setSupplements((x) => ({ ...x, heure_limite: v })), { type: 'number', min: 0, placeholder: '0' })}
          {champ('Pénalité de retard (% du prix)', penalite, setPenalite, { type: 'number', min: 0, max: 100, placeholder: '0' })}
        </Grid>
        <Text as="p" size="1" color="gray" mt="1">
          Le supplément s’ajoute au prix de la course selon le délai retenu. En cas de retard, la pénalité est remise au marchand sur sa facture.
        </Text>

        {fiche && (
          <>
            <Separator size="4" my="4" />
            <Flex align="center" justify="between" mb="2">
              <Text size="2" weight="bold">Comptes du portail ({fiche.accounts.length})</Text>
              <Button size="1" variant="soft" asChild><a href="/users">Inviter un compte</a></Button>
            </Flex>
            {fiche.accounts.length
              ? fiche.accounts.map((a) => <Text key={a.id} as="div" size="2">{a.name} · <Text color="gray">{a.email}</Text>{a.active ? '' : ' (désactivé)'}</Text>)
              : <Text size="2" color="gray">Aucun compte : le marchand ne peut pas encore déposer ses commandes lui-même.</Text>}
          </>
        )}

        <Flex align="center" justify="between" mt="4" gap="3" wrap="wrap">
          <Text as="label" size="2"><Flex gap="2" align="center">
            <Switch checked={active} onCheckedChange={setActive} disabled={!canEdit} /> Marchand actif
          </Flex></Text>
          <Flex gap="2">
            <Dialog.Close><Button variant="soft" color="gray">{canEdit ? 'Annuler' : 'Fermer'}</Button></Dialog.Close>
            {canEdit && <Button onClick={enregistrer} disabled={busy}>{fiche ? 'Enregistrer' : 'Créer le marchand'}</Button>}
          </Flex>
        </Flex>
        {error && <Callout.Root color="red" mt="3" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
      </Dialog.Content>
    </Dialog.Root>
  );
}
