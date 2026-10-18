'use client';
import * as React from 'react';
import { EcheanceBadge } from './EcheanceBadge';
import { describeDelay } from '@transpo/domain';
import Link from 'next/link';
import { copyText } from '../lib/clipboard';
import {
  Card, Flex, Box, Grid, Text, Heading, Button, IconButton, Badge, Separator,
  Tabs, Code, Callout, Tooltip,
} from '@radix-ui/themes';
import {
  ArrowLeftIcon, ChevronRightIcon, CopyIcon, CheckIcon, ClockIcon, HomeIcon,
  SewingPinFilledIcon, CubeIcon, DownloadIcon, InfoCircledIcon, ImageIcon, DotFilledIcon,
} from '@radix-ui/react-icons';
import { StatusBadge, CodChip, money } from '@transpo/ui-web';
import { LIFECYCLE, STATUS_META, proofRequirements } from '@transpo/domain';
import type { Order, OrderStatus } from '@transpo/domain';
import type { DeliveryProof } from '@transpo/api-client';
import type { Lang } from '@transpo/i18n';
import { OrderActions } from './OrderActions';
import { Map } from './Map';
import { dispatchEventLabel } from '../lib/dispatch-i18n';

/** Libellés de la carte des deux points (le reste de la fiche reste à traduire). */
const TL = {
  fr: {
    title: 'Localisation', retrait: 'Retrait', livraison: 'Livraison',
    open: 'Ouvrir dans Maps', missing: 'Non localisé', approxNote: 'Lien transmis au livreur pour la navigation.',
  },
  ar: {
    title: 'الموقع', retrait: 'الاستلام', livraison: 'التسليم',
    open: 'فتح في الخرائط', missing: 'غير محدد الموقع', approxNote: 'الرابط مُرسل إلى السائق للتنقل.',
  },
} as const;

/** Carte des deux points de la course + liens « Ouvrir dans Maps » (liens d'origine). */
function LocalisationCard({ order, lang }: { order: Order; lang: Lang }) {
  const t = TL[lang === 'ar' ? 'ar' : 'fr'];
  const points = ([
    ['retrait', order.pickupLat, order.pickupLng, order.pickupMapUrl, 'orange'],
    ['livraison', order.dropLat, order.dropLng, order.dropMapUrl, 'indigo'],
  ] as const).map(([k, lat, lng, url, color]) => ({ k, lat, lng, url, color, ok: lat != null && lng != null }));
  const situes = points.filter((p) => p.ok);
  if (situes.length === 0) return null;
  const fit = situes.map((p) => [p.lat as number, p.lng as number] as [number, number]);
  return (
    <Box mt="5" data-testid="order-locations">
      <Heading size="4" mb="3">{t.title}</Heading>
      <Box style={{ position: 'relative', height: 280, borderRadius: 'var(--radius-3)', overflow: 'hidden', border: '1px solid var(--gray-a5)' }}>
        <Map
          center={fit[0]} zoom={14} fit={fit}
          markers={situes.map((p) => ({
            id: p.k, kind: 'order' as const, lat: p.lat as number, lng: p.lng as number, color: p.color,
            label: t[p.k], sub: `${(p.lat as number).toFixed(5)}, ${(p.lng as number).toFixed(5)}`,
          }))}
          polylines={fit.length === 2 ? [{ id: 'trajet', latlngs: fit, color: 'gray', dashArray: '6 8' }] : []}
        />
      </Box>
      <Flex gap="3" mt="3" wrap="wrap">
        {points.map((p) => (
          <Flex key={p.k} align="center" gap="2">
            <Box style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--${p.color}-9)` }} />
            <Text size="2" weight="medium">{t[p.k]}</Text>
            {p.ok && p.url ? (
              <Button asChild size="1" variant="soft" data-testid={`open-maps-${p.k}`}>
                <a href={p.url} target="_blank" rel="noopener noreferrer"><SewingPinFilledIcon /> {t.open}</a>
              </Button>
            ) : <Text size="1" color="gray">{t.missing}</Text>}
          </Flex>
        ))}
      </Flex>
      <Text as="p" size="1" color="gray" mt="2">{t.approxNote}</Text>
    </Box>
  );
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function InfoBlock({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: React.ReactNode[] }) {
  return (
    <Box>
      <Flex align="center" gap="2" mb="2"><Box style={{ color: 'var(--indigo-11)' }}>{icon}</Box><Text size="2" weight="bold">{title}</Text></Flex>
      <Flex direction="column" gap="1">{lines.map((l, i) => <Text key={i} as="div" size="2" color={i === 0 ? undefined : 'gray'}>{l}</Text>)}</Flex>
    </Box>
  );
}

/** Preuve réellement capturée par le livreur (photo / signature), ou l'état d'attente. */
function ProofPanel({ order, proof }: { order: Order; proof: DeliveryProof | null }) {
  const required = proofRequirements(order.proofLevel);
  const items = ([['photo', proof?.photo], ['signature', proof?.signature]] as const)
    .filter(([kind]) => required.includes(kind));

  return (
    <>
      <Callout.Root color={proof?.captured ? 'green' : 'gray'} variant="surface" size="1" mb="3">
        <Callout.Icon>{proof?.captured ? <CheckIcon /> : <InfoCircledIcon />}</Callout.Icon>
        <Callout.Text>
          Preuve requise : <strong>{order.proofLevel}</strong>.{' '}
          {proof?.captured
            ? <>Déposée par <strong>{proof.capturedBy}</strong>{proof.capturedAt ? ` le ${new Date(proof.capturedAt).toLocaleString('fr-FR')}` : ''}.</>
            : order.status === 'LIVREE'
              ? 'Livraison confirmée sans artefact enregistré (antérieure à la capture de preuve).'
              : 'En attente de la livraison.'}
        </Callout.Text>
      </Callout.Root>

      {required.length === 0 ? (
        <Text size="2" color="gray">Aucune preuve n’est exigée pour cette commande.</Text>
      ) : (
        <Grid columns={{ initial: '1', sm: '2' }} gap="3">
          {items.map(([kind, src]) => (
            <Box key={kind}>
              <Text as="div" size="1" color="gray" weight="medium" mb="1">
                {kind === 'photo' ? 'Photo du colis livré' : 'Signature du destinataire'}
              </Text>
              {src ? (
                <Box style={{ borderRadius: 'var(--radius-3)', border: '1px solid var(--gray-a5)', overflow: 'hidden', background: kind === 'signature' ? '#fff' : 'var(--gray-a2)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI, pas d'optimisation possible */}
                  <img src={src} alt={kind === 'photo' ? 'Photo de livraison' : 'Signature du destinataire'}
                    style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'contain' }} />
                </Box>
              ) : (
                <Flex align="center" justify="center" gap="2" style={{ aspectRatio: '4/3', borderRadius: 'var(--radius-3)', border: '1px dashed var(--gray-a6)', background: 'var(--gray-a2)', color: 'var(--gray-9)' }}>
                  <ImageIcon width="18" height="18" /><Text size="1" color="gray">Non déposée</Text>
                </Flex>
              )}
            </Box>
          ))}
        </Grid>
      )}
    </>
  );
}

/** Un fait du journal de la commande. */
export type OrderEvent = { status: string; actor: string | null; note: string | null; at: string };

/** « 13/09/2026 · 14:32 » — date ET heure : un historique sans heure ne tranche aucun litige. */
function horodatage(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function OrderDetailClient({ order, drivers, proof, events, canWrite, commissionRate, vatRate, lang = 'fr' }: { order: Order; drivers: string[]; proof: DeliveryProof | null; events: OrderEvent[]; canWrite: boolean; commissionRate: number; vatRate: number; lang?: Lang }) {
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const idx = LIFECYCLE.indexOf(order.status as OrderStatus);
  /**
   * Hors contexte sécurisé (HTTP), `navigator.clipboard` est absent : l'appel optionnel
   * ne faisait rien mais la coche verte s'affichait quand même. Un retour qui ment est
   * pire que pas de retour — `copyText` tente le repli et dit s'il a échoué.
   */
  const copy = async () => {
    const ok = await copyText(order.code);
    setCopied(ok); setCopyError(!ok);
    setTimeout(() => { setCopied(false); setCopyError(false); }, 1800);
  };

  // Facturation dérivée du COD, aux taux commission/TVA configurés par le tenant (Paramètres).
  const codCollected = order.codPaid ? order.cod : 0;
  const commission = r2(codCollected * commissionRate);
  const netHt = r2(codCollected - commission);
  const tva = r2(netHt * vatRate);
  const ttc = r2(netHt + tva);

  return (
    <Box style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Flex align="center" gap="2" mb="3">
        <Button asChild variant="ghost" color="gray" size="2"><Link href="/orders"><ArrowLeftIcon /> Commandes</Link></Button>
        <ChevronRightIcon color="var(--gray-8)" />
        <Text size="2" color="gray">{order.ref}</Text>
      </Flex>

      <Flex justify="between" align="start" gap="4" wrap="wrap" mb="4">
        <Box>
          <Flex align="center" gap="3" mb="1">
            <Heading size="7" style={{ whiteSpace: 'nowrap' }}>{order.ref}</Heading>
            <StatusBadge status={order.status} />
          </Flex>
          <Flex align="center" gap="2">
            <Text size="2" color="gray">Code de suivi</Text>
            <Code variant="soft" size="2">{order.code}</Code>
            <Tooltip content={copyError ? 'Copie impossible — sélectionnez le code' : copied ? 'Copié !' : 'Copier le code'}>
              <IconButton
                size="1" variant="ghost" aria-label="Copier le code"
                color={copyError ? 'red' : copied ? 'green' : 'gray'} onClick={copy}
              >{copied ? <CheckIcon /> : <CopyIcon />}</IconButton>
            </Tooltip>
          </Flex>
        </Box>
        {canWrite && <OrderActions ref_={order.ref} status={order.status} driver={order.driver} drivers={drivers} cod={order.cod} codPaid={order.codPaid} />}
      </Flex>

      <Grid columns={{ initial: '1', md: '3' }} gap="4">
        {/* Timeline cycle de vie */}
        <Card size="3">
          <Heading size="4" mb="4">Cycle de vie</Heading>
          <Flex direction="column">
            {LIFECYCLE.map((s, i) => {
              const done = i < idx, cur = i === idx;
              return (
                <Flex key={s} gap="3">
                  <Flex direction="column" align="center">
                    <Flex align="center" justify="center" style={{ width: 24, height: 24, borderRadius: '50%', background: done ? 'var(--green-9)' : cur ? 'var(--indigo-9)' : 'var(--gray-a4)', color: done || cur ? 'white' : 'var(--gray-9)', flex: '0 0 24px' }}>
                      {done ? <CheckIcon width="13" /> : cur ? <DotFilledIcon /> : <Text size="1">{i + 1}</Text>}
                    </Flex>
                    {i < LIFECYCLE.length - 1 && <Box style={{ width: 2, flex: 1, minHeight: 26, background: i < idx ? 'var(--green-9)' : 'var(--gray-a4)' }} />}
                  </Flex>
                  <Box pb="3">
                    <Text as="div" size="2" weight={cur ? 'bold' : 'medium'} color={done || cur ? undefined : 'gray'}>{STATUS_META[s].fr}</Text>
                    <Text as="div" size="1" color="gray">{done || cur ? 'Franchi' : 'En attente'}</Text>
                  </Box>
                </Flex>
              );
            })}
          </Flex>
          {['ECHOUEE', 'RETOUR', 'ANNULEE'].includes(order.status) && (
            <Callout.Root color="red" size="1" mt="2"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>{STATUS_META[order.status as OrderStatus].fr}</Callout.Text></Callout.Root>
          )}
        </Card>

        {/* Onglets */}
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="3">
            <Tabs.Root defaultValue="details">
              <Tabs.List>
                <Tabs.Trigger value="details">Détails</Tabs.Trigger>
                <Tabs.Trigger value="proof">Preuve de livraison</Tabs.Trigger>
                <Tabs.Trigger value="history">Historique</Tabs.Trigger>
                <Tabs.Trigger value="billing">Facturation</Tabs.Trigger>
              </Tabs.List>

              <Box pt="4">
                <Tabs.Content value="details">
                  <Grid columns={{ initial: '1', sm: '2' }} gap="4">
                    {/* Les coordonnées des deux points sont désormais saisies ET conservées :
                        elles étaient collectées par l'assistant puis jetées (cf. TC-F01). */}
                    <InfoBlock
                      icon={<HomeIcon />} title="Retrait"
                      lines={[
                        order.pickupContact || order.merchant || '—',
                        order.pickupAddress || order.fromCity,
                        [order.fromCity, order.pickupPhone].filter(Boolean).join(' · '),
                        ...(order.pickupNotes ? [order.pickupNotes] : []),
                      ]}
                    />
                    <InfoBlock
                      icon={<SewingPinFilledIcon />} title="Livraison"
                      lines={[
                        order.dropContact || order.driver || 'À affecter',
                        order.dropAddress || order.toCity,
                        [order.toCity, order.dropPhone].filter(Boolean).join(' · '),
                        ...(order.dropNotes ? [order.dropNotes] : []),
                      ]}
                    />
                    <InfoBlock
                      icon={<CubeIcon />} title="Colis"
                      lines={[
                        `Taille : ${order.size}`,
                        `Preuve : ${order.proofLevel}`,
                        ...(order.vehicleType ? [`Véhicule : ${order.vehicleType}`] : []),
                        ...(order.description ? [order.description] : []),
                      ]}
                    />
                    <InfoBlock
                      icon={<ClockIcon />} title="Délai de livraison"
                      lines={[
                        order.delayMode && order.delayMode !== 'aucun'
                          ? describeDelay({ mode: order.delayMode, minutes: order.delayMinutes, heure: order.delayHeure })
                          : 'Sans contrainte (dans la journée)',
                        ...(order.retraitMinutes ? [`Retrait sous ${order.retraitMinutes} min après la commande`] : []),
                        <EcheanceBadge key="e" o={order} />,
                        ...(order.latePenalty ? [`Pénalité de retard : ${money(order.latePenalty)} HT remis au marchand`] : []),
                      ]}
                    />
                    <InfoBlock icon={<DownloadIcon />} title="Encaissement (COD)" lines={[<CodChip key="c" amount={order.cod} paid={order.codPaid} />, order.codPaid ? 'À reverser au marchand' : 'En attente d’encaissement']} />
                  </Grid>
                  <LocalisationCard order={order} lang={lang} />
                </Tabs.Content>

                <Tabs.Content value="proof">
                  <ProofPanel order={order} proof={proof} />
                </Tabs.Content>

                <Tabs.Content value="history">
                  {/* Faits réellement enregistrés, horodatés et attribués — et non le chemin
                      nominal déroulé jusqu'au statut courant, qui inventait des étapes pour
                      toute commande sortie du parcours nominal. */}
                  <Flex direction="column">
                    {events.map((e, i) => (
                      <Flex key={`${e.at}-${i}`} gap="3" py="2" data-testid="order-event"
                        style={{ borderBottom: i < events.length - 1 ? '1px solid var(--gray-a3)' : 'none' }}>
                        <Box style={{ width: 24, flex: '0 0 24px' }}>
                          <Box style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-9)', marginTop: 6 }} />
                        </Box>
                        <Box>
                          <Text as="div" size="2">
                            {/* Les faits de l'affectation automatique (proposition, refus,
                                expiration, exception) ne sont pas des statuts de commande. */}
                            {dispatchEventLabel(e.status, lang)
                              ?? <>Statut → {STATUS_META[e.status as OrderStatus]?.fr ?? e.status}</>}
                            {e.note ? ` · ${e.note}` : ''}
                          </Text>
                          <Text as="div" size="1" color="gray">
                            {horodatage(e.at)}{e.actor ? ` · ${e.actor}` : ''}
                          </Text>
                        </Box>
                      </Flex>
                    ))}
                    {events.length === 0 && (
                      <Text size="2" color="gray">
                        Aucun évènement enregistré — cette commande est antérieure au journal.
                      </Text>
                    )}
                  </Flex>
                </Tabs.Content>

                <Tabs.Content value="billing">
                  <Flex direction="column" gap="2">
                    {order.priceTtc != null && (
                      <>
                        <Flex justify="between" align="center">
                          <Text size="2" weight="bold">Prix de la course</Text>
                          <Badge color={order.pricingMode && order.pricingMode !== 'standard' ? 'indigo' : 'gray'} variant="soft">
                            {order.pricingMode === 'forfait' ? 'Forfait marchand' : order.pricingMode === 'remise' ? 'Grille remisée' : 'Grille standard'}
                          </Badge>
                        </Flex>
                        <Flex justify="between"><Text size="2" color="gray">{order.pricingMode === 'forfait' ? 'Forfait' : `Base · ${order.distanceKm != null ? Math.round(order.distanceKm * 10) / 10 : '—'} km`}</Text><Text size="2">{money(order.priceBase ?? 0)}</Text></Flex>
                        {(order.priceSurcharges ?? 0) > 0 && <Flex justify="between"><Text size="2" color="gray">Suppléments</Text><Text size="2">{money(order.priceSurcharges ?? 0)}</Text></Flex>}
                        <Flex justify="between"><Text size="2" color="gray">HT · TVA</Text><Text size="2">{money(order.priceHt ?? 0)} · {money(order.priceVat ?? 0)}</Text></Flex>
                        <Flex justify="between"><Text size="2" weight="medium">Prix TTC facturé au marchand</Text><Text size="2" weight="bold">{money(order.priceTtc)}</Text></Flex>
                        <Text size="1" color="gray">Prix figé à la création de la commande, aux conditions du marchand.</Text>
                        <Separator size="4" my="2" />
                      </>
                    )}
                    <Flex justify="between"><Text size="2" color="gray">COD encaissé</Text><Text size="2" weight="medium">{money(codCollected)}</Text></Flex>
                    <Flex justify="between"><Text size="2" color="gray">Commission ({Math.round(commissionRate * 100)} %)</Text><Text size="2" weight="medium">−{money(commission)}</Text></Flex>
                    <Separator size="4" />
                    <Flex justify="between"><Text size="2" weight="medium">Net à reverser HT</Text><Text size="2" weight="medium">{money(netHt)}</Text></Flex>
                    <Flex justify="between"><Text size="2" color="gray">TVA {Math.round(vatRate * 100)} %</Text><Text size="2" weight="medium">{money(tva)}</Text></Flex>
                    <Separator size="4" />
                    <Flex justify="between" align="center"><Text size="3" weight="bold">Total TTC</Text><Heading size="5">{money(ttc)}</Heading></Flex>
                    {codCollected === 0 && <Callout.Root color="gray" variant="surface" size="1" mt="2"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Aucun COD encaissé pour cette commande.</Callout.Text></Callout.Root>}
                  </Flex>
                </Tabs.Content>
              </Box>
            </Tabs.Root>
          </Card>
        </Box>
      </Grid>
    </Box>
  );
}
