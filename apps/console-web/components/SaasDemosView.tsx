'use client';
import * as React from 'react';
import { Box, Flex, Grid, Card, Heading, Text, Badge, Separator, Callout, Button } from '@radix-ui/themes';
import {
  PlayIcon, ClockIcon, PersonIcon, LayersIcon, InfoCircledIcon, CheckCircledIcon,
  ArrowLeftIcon, ArrowRightIcon, VideoIcon, ChatBubbleIcon,
} from '@radix-ui/react-icons';
import { PageHeader } from './ui';
import { CHAPITRES, VIDEO_COMPLETE, FIL_ROUGE, horodatage, type ChapitreDemo } from '../lib/demos';

const media = (nom: string) => `/api/demos/${nom}`;
/** Ancre d'un chapitre : un identifiant HTML ne doit pas commencer par un chiffre. */
const ancre = (c: { numero: number }) => `chapitre-${c.numero}`;

/** Lecteur vidéo : sous-titres français, et déplacement piloté depuis le déroulé. */
const Lecteur = React.forwardRef<HTMLVideoElement, { id: string; titre: string; disponible: boolean }>(
  function Lecteur({ id, titre, disponible }, ref) {
    if (!disponible) {
      return (
        <Flex align="center" justify="center" direction="column" gap="2"
          style={{ aspectRatio: '16 / 10', background: 'var(--gray-a3)', borderRadius: 'var(--radius-3)' }}>
          <VideoIcon width={22} height={22} color="var(--gray-9)" />
          <Text size="2" color="gray">Vidéo non publiée sur ce serveur</Text>
        </Flex>
      );
    }
    return (
      <video
        ref={ref}
        controls
        preload="metadata"
        poster={media(`${id}.jpg`)}
        aria-label={titre}
        style={{ width: '100%', aspectRatio: '16 / 10', display: 'block', background: '#000', borderRadius: 'var(--radius-3)' }}
      >
        <source src={media(`${id}.mp4`)} type="video/mp4" />
        <track kind="subtitles" srcLang="fr" label="Français" src={media(`${id}.vtt`)} />
      </video>
    );
  },
);

function Chapitre({ c, disponible, precedent, suivant }: {
  c: ChapitreDemo; disponible: boolean; precedent?: ChapitreDemo; suivant?: ChapitreDemo;
}) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [etapeCourante, setEtapeCourante] = React.useState(-1);

  // L'étape en cours suit la lecture : le déroulé sert aussi de repère pendant le visionnage.
  React.useEffect(() => {
    const v = video.current;
    if (!v) return;
    const suivre = () => {
      let i = -1;
      c.deroule.forEach((e, k) => { if (v.currentTime >= e.t) i = k; });
      setEtapeCourante(i);
    };
    v.addEventListener('timeupdate', suivre);
    return () => v.removeEventListener('timeupdate', suivre);
  }, [c.deroule]);

  function allerA(t: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = t;
    void v.play().catch(() => {});
    v.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <Box asChild id={ancre(c)} style={{ scrollMarginTop: 24 }}>
      <section aria-labelledby={`${ancre(c)}-titre`}>
        <Text size="1" weight="bold" color="indigo" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Chapitre {c.numero}
        </Text>
        <Heading id={`${ancre(c)}-titre`} size="7" mt="1">{c.titre}</Heading>
        <Text as="p" size="3" color="gray" mt="2">{c.accroche}</Text>
        <Flex gap="2" mt="3" wrap="wrap">
          <Badge color="gray" variant="soft" size="2" style={{ whiteSpace: 'normal', maxWidth: '100%' }}><PersonIcon /> {c.acteur}</Badge>
          <Badge color="indigo" variant="soft" size="2" style={{ whiteSpace: 'normal', maxWidth: '100%' }}><LayersIcon /> {c.surface}</Badge>
          <Badge color="gray" variant="outline" size="2"><ClockIcon /> {horodatage(c.duree)}</Badge>
        </Flex>

        <Card size="1" mt="4" style={{ padding: 6 }}>
          <Lecteur ref={video} id={c.id} titre={`Chapitre ${c.numero} — ${c.titre}`} disponible={disponible} />
        </Card>

        <Grid columns={{ initial: '1', md: '5' }} gap="5" mt="5">
          <Box style={{ gridColumn: 'span 3' }}>
            <Heading size="4" mb="3">Ce qui se passe</Heading>
            <Box asChild>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {c.deroule.map((e, k) => {
                  const actif = k === etapeCourante;
                  return (
                    <li key={e.t}>
                      <button
                        type="button"
                        onClick={() => allerA(e.t)}
                        disabled={!disponible}
                        aria-label={`Lire à ${horodatage(e.t)} : ${e.titre}`}
                        style={{
                          all: 'unset', boxSizing: 'border-box', width: '100%', cursor: disponible ? 'pointer' : 'default',
                          display: 'flex', gap: 14, padding: '10px 12px', borderRadius: 'var(--radius-3)',
                          background: actif ? 'var(--indigo-a3)' : 'transparent',
                          borderInlineStart: `3px solid ${actif ? 'var(--indigo-9)' : 'var(--gray-a5)'}`,
                        }}
                        className="tp-etape-demo"
                      >
                        <Text size="2" weight="bold" color={actif ? 'indigo' : 'gray'}
                          style={{ fontVariantNumeric: 'tabular-nums', minWidth: 38 }}>
                          {horodatage(e.t)}
                        </Text>
                        <Box>
                          <Text as="div" size="2" weight="medium">{e.titre}</Text>
                          <Text as="div" size="2" color="gray" mt="1">{e.texte}</Text>
                        </Box>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Box>
          </Box>

          <Flex direction="column" gap="4" style={{ gridColumn: 'span 2' }}>
            <Card size="2">
              <Heading size="3" mb="2">En résumé</Heading>
              <Text as="p" size="2" color="gray" style={{ lineHeight: 1.6 }}>{c.resume}</Text>
            </Card>
            <Card size="2">
              <Heading size="3" mb="3">À retenir</Heading>
              <Flex direction="column" gap="3">
                {c.aRetenir.map((r) => (
                  <Flex key={r} gap="2" align="start">
                    <CheckCircledIcon color="var(--green-9)" style={{ flexShrink: 0, marginTop: 3 }} />
                    <Text size="2">{r}</Text>
                  </Flex>
                ))}
              </Flex>
            </Card>
          </Flex>
        </Grid>

        <Flex justify="between" gap="3" mt="5" wrap="wrap">
          {precedent ? (
            <Button variant="soft" color="gray" asChild>
              <a href={`#${ancre(precedent)}`}><ArrowLeftIcon /> {precedent.numero}. {precedent.titre}</a>
            </Button>
          ) : <span />}
          {suivant && (
            <Button variant="soft" asChild>
              <a href={`#${ancre(suivant)}`}>{suivant.numero}. {suivant.titre} <ArrowRightIcon /></a>
            </Button>
          )}
        </Flex>
      </section>
    </Box>
  );
}

/** Sommaire collant : le chapitre visible est mis en évidence. */
function Sommaire({ actif }: { actif: string }) {
  return (
    <Box asChild style={{ position: 'sticky', top: 24 }}>
      <nav aria-label="Chapitres de la démo">
        <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Sommaire
        </Text>
        <Flex direction="column" gap="1" mt="3">
          {[{ cle: 'introduction', numero: null as number | null, titre: 'Vue d’ensemble', duree: VIDEO_COMPLETE.duree },
            ...CHAPITRES.map((c) => ({ cle: ancre(c), numero: c.numero as number | null, titre: c.titre, duree: c.duree }))].map((c) => {
            const estActif = actif === c.cle;
            return (
              <a key={c.cle} href={`#${c.cle}`} aria-current={estActif ? 'location' : undefined}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 10px', textDecoration: 'none',
                  borderRadius: 'var(--radius-2)', background: estActif ? 'var(--indigo-a3)' : 'transparent',
                  color: estActif ? 'var(--indigo-11)' : 'var(--gray-12)',
                }}>
                <Text size="1" color="gray" style={{ minWidth: 14, fontVariantNumeric: 'tabular-nums' }}>
                  {c.numero ?? '•'}
                </Text>
                <Text size="2" weight={estActif ? 'medium' : 'regular'} style={{ flex: 1 }}>{c.titre}</Text>
                <Text size="1" color="gray" style={{ fontVariantNumeric: 'tabular-nums' }}>{horodatage(c.duree)}</Text>
              </a>
            );
          })}
        </Flex>
      </nav>
    </Box>
  );
}

export function SaasDemosView({ disponibles }: { disponibles: string[] }) {
  const [actif, setActif] = React.useState('introduction');
  const dispo = (id: string) => disponibles.includes(`${id}.mp4`);

  React.useEffect(() => {
    const sections = ['introduction', ...CHAPITRES.map(ancre)]
      .map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver((entrees) => {
      const visible = entrees.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActif(visible.target.id);
    }, { rootMargin: '-20% 0px -60% 0px' });
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  const total = CHAPITRES.reduce((s, c) => s + c.duree, 0);

  return (
    <Box>
      <style>{`.tp-etape-demo:hover:not(:disabled){background:var(--gray-a3)}.tp-etape-demo:focus-visible{outline:2px solid var(--indigo-8);outline-offset:2px}`}</style>
      <PageHeader
        title="Démo produit"
        subtitle="La démonstration narrée de Portrail, chapitre par chapitre — pour présenter le produit, former une équipe ou préparer un rendez-vous."
      />

      <Grid columns={{ initial: '1', lg: '260px 1fr' }} gap="7" align="start">
        <Box display={{ initial: 'none', lg: 'block' }}>
          <Sommaire actif={actif} />
        </Box>

        <Flex direction="column" gap="9" style={{ minWidth: 0 }}>
          <Box asChild id="introduction" style={{ scrollMarginTop: 24 }}>
            <section aria-labelledby="introduction-titre">
              <Heading id="introduction-titre" size="7">Vue d’ensemble</Heading>
              <Text as="p" size="3" color="gray" mt="2" style={{ maxWidth: 760, lineHeight: 1.6 }}>
                On suit une société fictive, <strong>{FIL_ROUGE.societe}</strong>, transporteur basé à {FIL_ROUGE.ville},
                depuis sa première visite sur le site jusqu’au reversement de l’argent à ses marchands. Chaque chapitre
                montre un acteur dans son propre écran, et les chapitres s’enchaînent : la commande déposée par le marchand
                au chapitre 3 est affectée au chapitre 4, livrée au chapitre 5 et rapprochée au chapitre 6.
              </Text>

              <Grid columns={{ initial: '2', sm: '4' }} gap="3" mt="4">
                {[
                  { icon: <LayersIcon />, label: 'Chapitres', valeur: String(CHAPITRES.length) },
                  { icon: <ClockIcon />, label: 'Durée totale', valeur: `${Math.round(total / 60)} min` },
                  { icon: <ChatBubbleIcon />, label: 'Narration', valeur: 'Français' },
                  { icon: <VideoIcon />, label: 'Sous-titres', valeur: 'Français' },
                ].map((k) => (
                  <Card key={k.label} size="2">
                    <Flex align="center" gap="2"><Text color="indigo">{k.icon}</Text><Text size="1" color="gray">{k.label}</Text></Flex>
                    <Text as="div" size="5" weight="bold" mt="1">{k.valeur}</Text>
                  </Card>
                ))}
              </Grid>

              <Card size="2" mt="4">
                <Flex align="center" justify="between" gap="3" mb="3" wrap="wrap">
                  <Box>
                    <Heading size="4">La démo intégrale</Heading>
                    <Text size="2" color="gray">Les huit chapitres d’un seul tenant, pour une présentation complète.</Text>
                  </Box>
                  <Badge color="gray" variant="outline" size="2"><ClockIcon /> {horodatage(VIDEO_COMPLETE.duree)}</Badge>
                </Flex>
                <Lecteur id={VIDEO_COMPLETE.id} titre="Démo intégrale" disponible={dispo(VIDEO_COMPLETE.id)} />
              </Card>

              <Callout.Root mt="4" color="indigo" variant="surface">
                <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                <Callout.Text>
                  Le fil rouge tient en une phrase : <em>{FIL_ROUGE.devise}</em> Dans chaque chapitre, cliquez une étape du
                  déroulé pour lancer la vidéo à ce moment précis.
                </Callout.Text>
              </Callout.Root>

              <Heading size="4" mt="6" mb="3">Les chapitres</Heading>
              <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                {CHAPITRES.map((c) => (
                  <Card key={c.id} asChild size="2">
                    <a href={`#${ancre(c)}`} style={{ textDecoration: 'none' }}>
                      <Flex gap="3" align="start">
                        <Flex align="center" justify="center" style={{
                          width: 32, height: 32, flexShrink: 0, borderRadius: 'var(--radius-2)',
                          background: 'var(--indigo-a3)', color: 'var(--indigo-11)', fontWeight: 700,
                        }}>{c.numero}</Flex>
                        <Box style={{ minWidth: 0 }}>
                          <Flex align="center" gap="2" justify="between">
                            <Text size="2" weight="bold">{c.titre}</Text>
                            <Text size="1" color="gray" style={{ fontVariantNumeric: 'tabular-nums' }}>{horodatage(c.duree)}</Text>
                          </Flex>
                          <Text as="div" size="2" color="gray" mt="1">{c.accroche}</Text>
                          <Text as="div" size="1" color="indigo" mt="2"><PlayIcon style={{ verticalAlign: '-2px' }} /> {c.surface}</Text>
                        </Box>
                      </Flex>
                    </a>
                  </Card>
                ))}
              </Grid>
            </section>
          </Box>

          {CHAPITRES.map((c, i) => (
            <React.Fragment key={c.id}>
              <Separator size="4" />
              <Chapitre c={c} disponible={dispo(c.id)} precedent={CHAPITRES[i - 1]} suivant={CHAPITRES[i + 1]} />
            </React.Fragment>
          ))}
        </Flex>
      </Grid>
    </Box>
  );
}
