// Données de la journée, partagées par « Ma journée », « Tournée » et le détail d'un arrêt.
//
// Les règles de l'ancien écran Missions sont conservées à l'identique :
//  - hors ligne, on retombe sur le dernier chargement (cache) plutôt qu'une page vide ;
//  - un REFUS du serveur (403, 500…) n'est pas une coupure réseau : il s'affiche ;
//  - les actions encore en file sont reflétées sur les missions (`applyPending`) ;
//  - les propositions ne sont jamais servies depuis le cache (elles vivent 3 minutes).
import * as React from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Order } from '@transpo/domain';
import type { DriverCash, DriverOffer } from '@transpo/api-client';
import { authedClient, idemKey } from './api';
import { readJson, writeJson } from './storage';
import { applyPending, enqueue } from './outbox';
import { useOutbox } from './useOutbox';
import { ecouterPropositions } from './offer-signal';
import { usePosition } from './tracking';
import { ordonnerArrets, type Arret } from './journee';

export const CACHE_MISSIONS = 'transpo.missions.v1';
const CACHE_TOURNEE = 'transpo.tournee.v1';
export const CLE_ORDRE_MANUEL = 'transpo.ordre.v1';
// Sans push (appareil non enregistré), c'est cette relecture qui fait apparaître une proposition.
const RELECTURE_OFFRES_MS = 15_000;

let ordreManuel: string[] | null = null;
const abonnesOrdre = new Set<(o: string[] | null) => void>();

/** Ordre choisi à la main par le livreur (onglet Tournée). `null` = ordre calculé. */
export async function definirOrdreManuel(refs: string[] | null): Promise<void> {
  ordreManuel = refs;
  for (const f of abonnesOrdre) f(refs);
  await writeJson(CLE_ORDRE_MANUEL, refs);
}

export function useJournee(opts: { offres?: boolean } = {}) {
  const [missions, setMissions] = React.useState<Order[]>([]);
  const [tournee, setTournee] = React.useState<string[] | null>(null);
  const [offres, setOffres] = React.useState<DriverOffer[]>([]);
  const [decalage, setDecalage] = React.useState(0);
  const [caisse, setCaisse] = React.useState<DriverCash | null>(null);
  const [ordre, setOrdre] = React.useState<string[] | null>(ordreManuel);
  const [chargement, setChargement] = React.useState(true);
  const [perime, setPerime] = React.useState(false);
  const [erreurServeur, setErreurServeur] = React.useState<number | null>(null);
  const moi = usePosition();

  const lireOffres = React.useCallback(async () => {
    try {
      const f = await authedClient().getMyOffers();
      setOffres(f);
      if (f[0]) setDecalage(new Date(f[0].serverNow).getTime() - Date.now());
    } catch {
      setOffres([]);
    }
  }, []);

  const recharger = React.useCallback(async () => {
    if (opts.offres) void lireOffres();
    try {
      const frais = await authedClient().getMissions();
      setMissions(frais);
      setPerime(false);
      setErreurServeur(null);
      await writeJson(CACHE_MISSIONS, frais);
      const t = await authedClient().getMyTour().catch(() => undefined);
      if (t !== undefined) {
        const refs = t ? t.stops.map((o) => o.ref) : null;
        setTournee(refs);
        await writeJson(CACHE_TOURNEE, refs);
      }
      authedClient().getMyCash().then(setCaisse).catch(() => undefined);
    } catch (e) {
      setMissions(await readJson<Order[]>(CACHE_MISSIONS, []));
      setTournee(await readJson<string[] | null>(CACHE_TOURNEE, null));
      setPerime(true);
      setErreurServeur((e as { status?: number })?.status ?? null);
    } finally {
      setChargement(false);
    }
  }, [lireOffres, opts.offres]);

  const outbox = useOutbox((r) => {
    if (r.rejected.length > 0) {
      Alert.alert('Action refusée · إجراء مرفوض', r.rejected.map((x) => `${x.ref} — ${x.reason}`).join('\n'));
    }
    void recharger();
  });

  React.useEffect(() => {
    abonnesOrdre.add(setOrdre);
    if (ordreManuel === null) readJson<string[] | null>(CLE_ORDRE_MANUEL, null).then((o) => { ordreManuel = o; setOrdre(o); });
    return () => { abonnesOrdre.delete(setOrdre); };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void recharger();
      void outbox.sync();
      if (!opts.offres) return undefined;
      const id = setInterval(() => { void lireOffres(); }, RELECTURE_OFFRES_MS);
      const off = ecouterPropositions(() => { void lireOffres(); });
      return () => { clearInterval(id); off(); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recharger, lireOffres, opts.offres]),
  );

  /**
   * Réponse à une proposition : écrite dans la file d'abord (hors ligne compris), puis
   * envoyée. Clé d'idempotence stable par (proposition, décision).
   */
  const repondre = React.useCallback(async (f: DriverOffer, decision: 'accept' | 'refuse') => {
    await enqueue({ kind: 'offer', ref: f.ref, offerId: f.id, decision, idemKey: idemKey(f.id, `offer-${decision}`) });
    setOffres((l) => l.filter((x) => x.id !== f.id));
    await outbox.sync();
    await recharger();
  }, [outbox, recharger]);

  const vues = applyPending(missions, outbox.pending);
  const arrets: Arret[] = React.useMemo(
    () => ordonnerArrets(vues, { tournee, ordreManuel: ordre, moi: moi ? { lat: moi.lat, lng: moi.lng } : null }),
    // `vues` change d'identité à chaque rendu : on dépend de ce qui le compose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [missions, outbox.pending, tournee, ordre, moi?.lat, moi?.lng],
  );

  return {
    missions: vues, arrets, tournee, ordreManuel: ordre, offres, decalage, caisse, moi,
    chargement, perime, erreurServeur, recharger, lireOffres, repondre, ...outbox,
  };
}
