'use client';
import * as React from 'react';
import {
  Card, Flex, Box, Text, Heading, Badge, Button, TextField, IconButton, Table, Callout,
  Separator, Code, ScrollArea, Link as RLink,
} from '@radix-ui/themes';
import {
  MagnifyingGlassIcon, Cross2Icon, FileTextIcon, VideoIcon, InfoCircledIcon,
  CheckCircledIcon, ExclamationTriangleIcon, ImageIcon,
} from '@radix-ui/react-icons';
import { PageHeader } from './ui';
import { fragments, type Bloc } from '../lib/markdown';
import type { PageDoc, Section } from '../lib/docs';
import type { RunRecette, CasRecette, Preuve } from '../lib/recette';

const PREUVES = '__preuves__';

/* ───────────────────────────── rendu du Markdown ───────────────────────────── */

function Ligne({ texte }: { texte: string }) {
  return (
    <>
      {fragments(texte).map((f, i) => {
        switch (f.t) {
          case 'gras': return <strong key={i}>{f.v}</strong>;
          case 'ital': return <em key={i}>{f.v}</em>;
          case 'code': return <Code key={i} variant="soft" color="gray">{f.v}</Code>;
          case 'lien': return <Lien key={i} href={f.href}>{f.v}</Lien>;
          default: return <React.Fragment key={i}>{f.v}</React.Fragment>;
        }
      })}
    </>
  );
}

/**
 * Un lien interne pointe vers un autre fichier de `docs/produit/` : il change de page
 * sans recharger, plutôt que de mener à un 404. Les liens externes restent des liens.
 */
function Lien({ href, children }: { href: string; children: React.ReactNode }) {
  const nav = React.useContext(NavContexte);
  const interne = /\.md(#.*)?$/.test(href);
  if (!interne) {
    return <RLink href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{children}</RLink>;
  }
  const [fichier, ancre] = href.split('#');
  return (
    <RLink
      href={href}
      onClick={(e) => { e.preventDefault(); nav(fichier!.replace(/\.md$/, ''), ancre); }}
    >{children}</RLink>
  );
}

const NavContexte = React.createContext<(slug: string, ancre?: string) => void>(() => {});

function TailleTitre(niveau: number): '6' | '5' | '4' | '3' {
  if (niveau <= 1) return '6';   // séparateur de partie (« Opérations », « Flotte »…)
  if (niveau === 2) return '5';
  if (niveau === 3) return '4';
  return '3';
}

/** Titre débarrassé de ses marques Markdown — pour le sommaire, qui ne les rend pas. */
export function texteNu(texte: string): string {
  return texte
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function RenduBloc({ bloc }: { bloc: Bloc }) {
  switch (bloc.t) {
    case 'titre':
      return (
        <Heading
          id={bloc.id}
          size={TailleTitre(bloc.niveau)}
          weight="bold"
          mt={bloc.niveau <= 2 ? '6' : '5'}
          mb="2"
          style={{ scrollMarginTop: 72 }}
        >
          <Ligne texte={bloc.texte} />
        </Heading>
      );

    case 'para':
      return <Text as="p" size="2" mb="3" style={{ lineHeight: 1.65 }}><Ligne texte={bloc.texte} /></Text>;

    case 'liste': {
      const Balise = bloc.ordonnee ? 'ol' : 'ul';
      return (
        <Balise style={{ margin: '0 0 var(--space-3)', paddingInlineStart: 'var(--space-5)' }}>
          {bloc.items.map((it, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <Text size="2" style={{ lineHeight: 1.6 }}><Ligne texte={it} /></Text>
            </li>
          ))}
        </Balise>
      );
    }

    case 'code':
      return (
        <Card size="1" variant="surface" mb="3">
          <ScrollArea scrollbars="horizontal">
            <Box p="2">
              <pre style={{ margin: 0, fontFamily: 'var(--code-font-family)', fontSize: 12.5, lineHeight: 1.6 }}>
                {bloc.code}
              </pre>
            </Box>
          </ScrollArea>
        </Card>
      );

    case 'tableau':
      return (
        <Card size="1" mb="4">
          <ScrollArea scrollbars="horizontal">
            <Table.Root size="1" variant="ghost">
              <Table.Header>
                <Table.Row>
                  {bloc.entetes.map((h, i) => (
                    <Table.ColumnHeaderCell key={i}><Ligne texte={h} /></Table.ColumnHeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {bloc.lignes.map((l, i) => (
                  <Table.Row key={i}>
                    {l.map((c, j) => (
                      j === 0
                        ? <Table.RowHeaderCell key={j}><Text size="2"><Ligne texte={c} /></Text></Table.RowHeaderCell>
                        : <Table.Cell key={j}><Text size="2"><Ligne texte={c} /></Text></Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </ScrollArea>
        </Card>
      );

    case 'citation':
      return (
        <Callout.Root color="amber" variant="surface" size="1" mb="3">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text><Ligne texte={bloc.texte} /></Callout.Text>
        </Callout.Root>
      );

    default:
      return <Separator size="4" my="5" />;
  }
}

function RenduBlocs({ blocs }: { blocs: Bloc[] }) {
  return <>{blocs.map((b, i) => <RenduBloc key={i} bloc={b} />)}</>;
}

/* ───────────────────────────── preuves de recette ───────────────────────────── */

const poids = (o: number) => `${(o / 1_048_576).toFixed(1)} Mo`;

function VerdictBadge({ v }: { v: string }) {
  const t = v.toUpperCase();
  if (t.startsWith('OK')) return <Badge color="green" variant="soft" radius="full">{v}</Badge>;
  if (t.startsWith('KO') || t.includes('ÉCHEC')) return <Badge color="red" variant="soft" radius="full">{v}</Badge>;
  if (t.includes('BLOQU')) return <Badge color="amber" variant="soft" radius="full">{v}</Badge>;
  return <Badge color="gray" variant="soft" radius="full">{v}</Badge>;
}

function Lecteur({ run, preuve }: { run: string; preuve: Preuve }) {
  const src = `/api/docs/preuve?run=${encodeURIComponent(run)}&f=${encodeURIComponent(preuve.fichier)}`;
  return (
    <Box>
      <video
        controls
        preload="metadata"
        src={src}
        style={{ width: '100%', maxWidth: 520, borderRadius: 'var(--radius-3)', background: 'var(--gray-3)', display: 'block' }}
      />
      <Text as="div" size="1" color="gray" mt="1">
        {preuve.fichier} · {preuve.format.toUpperCase()} · {poids(preuve.octets)}
      </Text>
    </Box>
  );
}

function CasLigne({ run, cas }: { run: string; cas: CasRecette }) {
  const [ouvert, setOuvert] = React.useState(false);
  const dispo = cas.preuves.length > 0;

  return (
    <Box py="3" style={{ borderTop: '1px solid var(--gray-a4)' }}>
      <Flex align="start" justify="between" gap="3" wrap="wrap">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Flex align="center" gap="2" wrap="wrap" mb="1">
            <Text size="2" weight="bold">{cas.id}</Text>
            <VerdictBadge v={cas.verdict} />
            {cas.captures > 0 && (
              <Badge color="gray" variant="soft" radius="full"><ImageIcon width="11" /> {cas.captures}</Badge>
            )}
          </Flex>
          {cas.titre && <Text as="div" size="2" weight="medium">{cas.titre}</Text>}
          {cas.constat && (
            <Text as="div" size="1" color="gray" mt="1" style={{ lineHeight: 1.5 }}>
              <Ligne texte={cas.constat} />
            </Text>
          )}
        </Box>
        <Box style={{ flex: '0 0 auto' }}>
          {dispo ? (
            <Button size="1" variant="soft" onClick={() => setOuvert((v) => !v)}>
              <VideoIcon /> {ouvert ? 'Masquer' : `Voir (${cas.preuves.length})`}
            </Button>
          ) : (
            <Text size="1" color="gray">Preuve non disponible dans cet environnement</Text>
          )}
        </Box>
      </Flex>
      {ouvert && (
        <Flex direction="column" gap="3" mt="3">
          {cas.preuves.map((p) => <Lecteur key={p.fichier} run={run} preuve={p} />)}
        </Flex>
      )}
    </Box>
  );
}

function PreuvesVue({ runs }: { runs: RunRecette[] }) {
  const [q, setQ] = React.useState('');
  const total = runs.reduce((a, r) => a + r.cas.length, 0);
  const avec = runs.reduce((a, r) => a + r.avecPreuve, 0);
  const filtre = q.trim().toLowerCase();

  return (
    <Box>
      <Heading size="6" weight="bold" mb="2">Preuves vidéo</Heading>
      <Text as="p" size="2" color="gray" mb="4" style={{ lineHeight: 1.65 }}>
        Enregistrements des runs de recette. Les <strong>verdicts</strong> sont versionnés dans
        <Code variant="soft" color="gray" ml="1">qa/recette/&lt;run&gt;/RAPPORT.md</Code> ; les{' '}
        <strong>enregistrements ne le sont pas</strong> — 138 vidéos pèsent 147 Mo et gonfleraient le
        dépôt définitivement. Un environnement cloné depuis Git n'en porte donc aucun, et chaque
        ligne ci-dessous le dit plutôt que d'afficher un lecteur cassé.
      </Text>

      {runs.length === 0 ? (
        <Callout.Root color="gray" variant="surface">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>Aucun run de recette sur le disque de cet environnement.</Callout.Text>
        </Callout.Root>
      ) : (
        <>
          <Flex gap="3" align="center" wrap="wrap" mb="4">
            <Badge color="indigo" variant="soft" size="2">{runs.length} run(s)</Badge>
            <Badge color="gray" variant="soft" size="2">{total} cas</Badge>
            <Badge color={avec ? 'green' : 'amber'} variant="soft" size="2">
              {avec} enregistrement(s) présent(s)
            </Badge>
            <Box style={{ flex: 1, minWidth: 220, maxWidth: 320 }}>
              <TextField.Root
                size="2" radius="large" placeholder="Filtrer un cas (TC-G07, caisse…)"
                value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrer les cas de recette"
              >
                <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
              </TextField.Root>
            </Box>
          </Flex>

          {runs.map((run) => {
            const cas = filtre
              ? run.cas.filter((c) => `${c.id} ${c.titre} ${c.constat}`.toLowerCase().includes(filtre))
              : run.cas;
            if (!cas.length) return null;
            return (
              <Card size="3" key={run.id} mb="4">
                <Flex align="center" justify="between" gap="3" wrap="wrap" mb="2">
                  <Box>
                    <Heading size="4">{run.id}</Heading>
                    <Text as="div" size="1" color="gray">
                      {cas.length} cas affiché(s) · {run.avecPreuve} enregistrement(s) · {run.captures} capture(s)
                    </Text>
                  </Box>
                  {run.avecPreuve === 0
                    ? <Badge color="amber" variant="soft" radius="full"><ExclamationTriangleIcon width="12" /> aucune vidéo ici</Badge>
                    : <Badge color="green" variant="soft" radius="full"><CheckCircledIcon width="12" /> vidéos présentes</Badge>}
                </Flex>
                {cas.map((c) => <CasLigne key={c.id} run={run.id} cas={c} />)}
              </Card>
            );
          })}
        </>
      )}
    </Box>
  );
}

/* ───────────────────────────── page ───────────────────────────── */

export function DocsView({ pages, runs }: { pages: PageDoc[]; runs: RunRecette[] }) {
  const [actif, setActif] = React.useState<string>(pages[0]?.slug ?? PREUVES);
  const [q, setQ] = React.useState('');
  const recherche = q.trim().toLowerCase();

  const naviguer = React.useCallback((slug: string, ancre?: string) => {
    setQ('');
    setActif(slug);
    // Le contenu de la page de destination n'est monté qu'au rendu suivant.
    if (ancre) window.setTimeout(() => document.getElementById(ancre)?.scrollIntoView({ behavior: 'smooth' }), 60);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const resultats = React.useMemo(() => {
    if (!recherche) return [];
    return pages
      .map((p) => ({ page: p, sections: p.sections.filter((s) => s.texte.includes(recherche)) }))
      .filter((r) => r.sections.length > 0);
  }, [pages, recherche]);
  const nbResultats = resultats.reduce((a, r) => a + r.sections.length, 0);

  const page = pages.find((p) => p.slug === actif) ?? null;

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader
        title="Documentation"
        subtitle="Le produit tel qu'il est — écrans, règles, API, exploitation. Les réserves et les manques sont dits à l'endroit où ils se posent."
      />

      <Flex direction={{ initial: 'column', md: 'row' }} gap="5" align="start">
        {/* Sommaire */}
        <Box style={{ width: 264, flex: '0 0 auto', position: 'sticky', top: 72, alignSelf: 'flex-start' }}>
          <Card size="2">
            <TextField.Root
              size="2" radius="large" placeholder="Rechercher dans la documentation…"
              value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher dans la documentation"
            >
              <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
              {q && (
                <TextField.Slot side="right">
                  <IconButton size="1" variant="ghost" color="gray" type="button" aria-label="Effacer la recherche" onClick={() => setQ('')}>
                    <Cross2Icon />
                  </IconButton>
                </TextField.Slot>
              )}
            </TextField.Root>

            {recherche && (
              <Text as="div" size="1" color="gray" mt="2">
                {nbResultats} section(s) sur {pages.length} document(s)
              </Text>
            )}

            <Separator size="4" my="3" />

            <Flex direction="column" gap="1">
              {pages.map((p) => (
                <Box key={p.slug}>
                  <Button
                    variant={!recherche && actif === p.slug ? 'soft' : 'ghost'}
                    color={!recherche && actif === p.slug ? 'indigo' : 'gray'}
                    size="2"
                    style={{ width: '100%', justifyContent: 'flex-start', gap: 'var(--space-2)' }}
                    onClick={() => naviguer(p.slug)}
                  >
                    <FileTextIcon width={15} height={15} />
                    <Text size="2" style={{ textAlign: 'start' }}>{p.titre}</Text>
                  </Button>
                  {!recherche && actif === p.slug && p.sections.length > 0 && (
                    <Flex direction="column" gap="1" mt="1" mb="2" ml="4" style={{ borderInlineStart: '1px solid var(--gray-a5)', paddingInlineStart: 'var(--space-2)' }}>
                      {p.sections.map((s) => (
                        <RLink
                          key={s.id}
                          href={`#${s.id}`}
                          size="1"
                          color="gray"
                          onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                        >{texteNu(s.titre)}</RLink>
                      ))}
                    </Flex>
                  )}
                </Box>
              ))}

              <Separator size="4" my="2" />

              <Button
                variant={!recherche && actif === PREUVES ? 'soft' : 'ghost'}
                color={!recherche && actif === PREUVES ? 'indigo' : 'gray'}
                size="2"
                style={{ width: '100%', justifyContent: 'flex-start', gap: 'var(--space-2)' }}
                onClick={() => naviguer(PREUVES)}
              >
                <VideoIcon width={15} height={15} />
                <Text size="2">Preuves vidéo</Text>
              </Button>
            </Flex>
          </Card>
        </Box>

        {/* Contenu */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <NavContexte.Provider value={naviguer}>
            <Card size="4">
              {recherche
                ? <Resultats resultats={resultats} onOuvrir={naviguer} />
                : actif === PREUVES
                  ? <PreuvesVue runs={runs} />
                  : page
                    ? (
                      <Box>
                        <Heading size="7" weight="bold" mb="3">{page.titre}</Heading>
                        <RenduBlocs blocs={page.intro} />
                        {page.sections.map((s) => <RenduBlocs key={s.id} blocs={s.blocs} />)}
                      </Box>
                    )
                    : (
                      <Callout.Root color="gray" variant="surface">
                        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                        <Callout.Text>
                          Aucun document trouvé dans <Code variant="soft" color="gray">docs/produit/</Code> sur cet
                          environnement.
                        </Callout.Text>
                      </Callout.Root>
                    )}
            </Card>
          </NavContexte.Provider>
        </Box>
      </Flex>
    </Box>
  );
}

function Resultats({ resultats, onOuvrir }: {
  resultats: { page: PageDoc; sections: Section[] }[];
  onOuvrir: (slug: string, ancre?: string) => void;
}) {
  if (resultats.length === 0) {
    return (
      <Callout.Root color="gray" variant="surface">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>Aucune section ne contient ce terme.</Callout.Text>
      </Callout.Root>
    );
  }
  return (
    <Box>
      {resultats.map(({ page, sections }) => (
        <Box key={page.slug} mb="5">
          <Flex align="center" gap="2" mb="2">
            <FileTextIcon />
            <Heading size="4">{page.titre}</Heading>
            <Badge color="gray" variant="soft" radius="full">{sections.length}</Badge>
          </Flex>
          <Flex direction="column" gap="2">
            {sections.map((s) => (
              <Card key={s.id} size="2" asChild>
                <button
                  type="button"
                  onClick={() => onOuvrir(page.slug, s.id)}
                  style={{ textAlign: 'start', cursor: 'pointer', width: '100%', border: 0, font: 'inherit' }}
                >
                  {/* `span` et non `div` : le contenu d'un <button> est du contenu de
                      phrasé, et un bloc à l'intérieur produit un HTML invalide. */}
                  <Text as="span" size="2" weight="medium" style={{ display: 'block' }}>{texteNu(s.titre)}</Text>
                  <Text as="span" size="1" color="gray" mt="1" style={{
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {s.blocs.filter((b) => b.t === 'para').map((b) => (b as { texte: string }).texte).join(' ').slice(0, 220)}
                  </Text>
                </button>
              </Card>
            ))}
          </Flex>
        </Box>
      ))}
    </Box>
  );
}
