'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Text, Badge, Button, TextField, TextArea, Select, Separator,
} from '@radix-ui/themes';
import { MagnifyingGlassIcon, EnvelopeClosedIcon } from '@radix-ui/react-icons';
import type { DemoRequest } from '@transpo/api-client';
import { PageHeader } from './ui';

const STATUTS: Record<string, { libelle: string; couleur: 'amber' | 'green' | 'gray' }> = {
  NOUVELLE: { libelle: 'Nouvelle', couleur: 'amber' },
  CONTACTE: { libelle: 'Contactée', couleur: 'green' },
  ARCHIVEE: { libelle: 'Archivée', couleur: 'gray' },
};

function quand(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Demandes de démonstration déposées depuis le site vitrine.
 *
 * Une demande est du travail commercial, pas une ligne de journal : la vue est donc faite
 * de fiches lisibles d'un coup d'œil — qui, où, combien de livreurs, ce qu'il cherche à
 * régler — et non d'un tableau dense. Le suivi tient en deux gestes : marquer contactée,
 * archiver.
 */
export function SaasDemandesView({ demandes }: { demandes: DemoRequest[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [statut, setStatut] = React.useState('NOUVELLE');
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [enCours, setEnCours] = React.useState<string | null>(null);

  const lignes = demandes.filter((d) => {
    if (statut !== 'all' && d.statut !== statut) return false;
    if (!q) return true;
    const foin = `${d.societe} ${d.nom} ${d.email} ${d.villes ?? ''} ${d.message ?? ''}`.toLowerCase();
    return foin.includes(q.toLowerCase());
  });

  const nouvelles = demandes.filter((d) => d.statut === 'NOUVELLE').length;

  async function suivre(d: DemoRequest, vers: string) {
    setEnCours(d.id);
    try {
      await fetch(`/api/proxy/v1/saas/demo-requests/${d.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ statut: vers, note: notes[d.id] ?? d.note ?? undefined }),
      });
      router.refresh();
    } finally {
      setEnCours(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Demandes de démonstration"
        subtitle={`${nouvelles} nouvelle(s) · ${demandes.length} au total · déposées depuis le site vitrine`}
      />

      <Flex gap="3" mb="4" wrap="wrap">
        <TextField.Root
          placeholder="Rechercher (société, contact, ville, besoin)…"
          value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 300 }}
        >
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
        </TextField.Root>
        <Select.Root value={statut} onValueChange={setStatut}>
          <Select.Trigger aria-label="Filtrer par statut" />
          <Select.Content>
            <Select.Item value="NOUVELLE">Nouvelles</Select.Item>
            <Select.Item value="CONTACTE">Contactées</Select.Item>
            <Select.Item value="ARCHIVEE">Archivées</Select.Item>
            <Select.Item value="all">Toutes</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {lignes.length === 0 ? (
        <Card size="3">
          <Text color="gray">
            Aucune demande dans ce filtre. Les demandes arrivent du formulaire du site vitrine.
          </Text>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          {lignes.map((d) => {
            const s = STATUTS[d.statut] ?? STATUTS.NOUVELLE!;
            return (
              <Card key={d.id} size="3">
                <Flex justify="between" align="start" gap="3" wrap="wrap">
                  <Box>
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text size="4" weight="bold">{d.societe}</Text>
                      <Badge color={s.couleur}>{s.libelle}</Badge>
                      {d.source === 'accroche' && <Badge color="gray" variant="soft">depuis l’accroche</Badge>}
                    </Flex>
                    <Text as="p" size="2" color="gray" mt="1">
                      {d.nom} · <a href={`mailto:${d.email}`}>{d.email}</a>
                      {d.telephone ? ` · ${d.telephone}` : ''}
                    </Text>
                  </Box>
                  <Text size="1" color="gray">{quand(d.createdAt)}</Text>
                </Flex>

                <Flex gap="5" wrap="wrap" mt="3">
                  <Box>
                    <Text size="1" color="gray" as="div">Villes couvertes</Text>
                    <Text size="2">{d.villes || '—'}</Text>
                  </Box>
                  <Box>
                    <Text size="1" color="gray" as="div">Livreurs</Text>
                    <Text size="2">{d.livreurs ?? '—'}</Text>
                  </Box>
                </Flex>

                {d.message && (
                  <Box mt="3">
                    <Text size="1" color="gray" as="div">Ce qu’il cherche à régler</Text>
                    <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>{d.message}</Text>
                  </Box>
                )}

                <Separator size="4" my="3" />

                <Flex gap="3" align="end" wrap="wrap">
                  <Box style={{ flex: '1 1 280px' }}>
                    <Text as="label" size="1" color="gray" htmlFor={`note-${d.id}`}>Note de suivi (interne)</Text>
                    <TextArea
                      id={`note-${d.id}`} rows={2} mt="1"
                      placeholder="Rappelé le…, rendez-vous fixé au…"
                      value={notes[d.id] ?? d.note ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                    />
                  </Box>
                  <Flex gap="2" wrap="wrap">
                    <Button asChild variant="soft">
                      <a href={`mailto:${d.email}?subject=${encodeURIComponent(`Démonstration Portrail — ${d.societe}`)}`}>
                        <EnvelopeClosedIcon /> Répondre
                      </a>
                    </Button>
                    {d.statut !== 'CONTACTE' && (
                      <Button disabled={enCours === d.id} onClick={() => suivre(d, 'CONTACTE')}>
                        Marquer contactée
                      </Button>
                    )}
                    {d.statut !== 'ARCHIVEE' && (
                      <Button variant="soft" color="gray" disabled={enCours === d.id} onClick={() => suivre(d, 'ARCHIVEE')}>
                        Archiver
                      </Button>
                    )}
                    {d.statut !== 'NOUVELLE' && (
                      <Button variant="soft" color="amber" disabled={enCours === d.id} onClick={() => suivre(d, 'NOUVELLE')}>
                        Rouvrir
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </Card>
            );
          })}
        </Flex>
      )}
    </>
  );
}
