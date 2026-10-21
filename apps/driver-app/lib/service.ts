// La journée de service du livreur : démarrée / terminée, et le temps de conduite.
//
// État partagé par plusieurs écrans (Ma journée, Profil, la barre d'onglets qui porte le
// suivi de position) : un petit magasin en mémoire, persisté pour survivre à un
// redémarrage, plutôt qu'un état local recopié dans chaque écran.
//
// Démarrer la journée :
//  - rend le livreur DISPONIBLE côté serveur (c'est ce que lit l'affectation automatique) ;
//  - active le partage de position (`useTracking`, monté dans le layout des onglets) ;
//  - lance le compteur de conduite (100 % local : aucun endpoint serveur ne le tient).
//
// Le temps de conduite ne compte que les DÉPLACEMENTS mesurés par le GPS (vitesse ≥ 7 km/h
// entre deux points) : un livreur en service mais arrêté (attente, pause, client) ne se
// voit plus imposer une pause de 45 min qu'il n'a pas méritée.
import * as React from 'react';
import { readJson, writeJson } from './storage';
import { authedClient } from './api';
import { dureeEnMouvement } from './journee';

const KEY = 'transpo.shift.v1';

export interface EtatService {
  active: boolean;
  /** Jour courant (AAAA-MM-JJ) : tout repart à zéro chaque jour. */
  date: string;
  /** Premier démarrage du jour (ISO). */
  startedAt: string | null;
  /** Conduite cumulée du jour : temps passé en mouvement (GPS). */
  drivenMs: number;
  /** Dernière reprise (ISO), `null` à l'arrêt. */
  resumedAt: string | null;
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function neuf(): EtatService {
  return { active: false, date: aujourdhui(), startedAt: null, drivenMs: 0, resumedAt: null };
}

let etat: EtatService = neuf();
let charge: Promise<EtatService> | null = null;
const abonnes = new Set<(e: EtatService) => void>();

function publier(e: EtatService) {
  etat = e;
  for (const f of abonnes) f(e);
  void writeJson(KEY, e);
  // Relue par l'écran Réglages, qui affiche l'état du partage de position.
  void writeJson('transpo.tracking.enabled', e.active);
}

function chargerService(): Promise<EtatService> {
  if (!charge) {
    charge = readJson<EtatService>(KEY, neuf()).then((lu) => {
      etat = lu.date === aujourdhui() ? lu : neuf();
      for (const f of abonnes) f(etat);
      return etat;
    });
  }
  return charge;
}

/** Disponibilité côté serveur. Sans réseau, l'échec est sans gravité : le prochain démarrage la renverra. */
async function disponibilite(available: boolean): Promise<void> {
  try { await authedClient().setMyAvailability(available); } catch { /* hors ligne */ }
}

export async function demarrerJournee(): Promise<void> {
  await chargerService();
  const now = new Date().toISOString();
  publier({ ...etat, active: true, startedAt: etat.startedAt ?? now, resumedAt: now });
  await disponibilite(true);
}

export async function terminerJournee(): Promise<void> {
  await chargerService();
  dernierPoint = null;
  publier({ ...etat, active: false, resumedAt: null });
  await disponibilite(false);
}

let dernierPoint: { lat: number; lng: number; at: number } | null = null;

/** Appelé à chaque point GPS du suivi : ajoute le temps écoulé s'il y a eu déplacement. */
export function noterPosition(p: { lat: number; lng: number; at: number }): void {
  const avant = dernierPoint;
  dernierPoint = p;
  if (!etat.active || !avant) return;
  const dt = dureeEnMouvement(avant, p);
  if (dt > 0) publier({ ...etat, drivenMs: etat.drivenMs + dt });
}


export function conduiteMs(e: EtatService): number {
  return e.drivenMs;
}

export function amplitudeMs(e: EtatService): number {
  return e.startedAt ? Date.now() - new Date(e.startedAt).getTime() : 0;
}

/** État du service, réactif. `pret` : faux tant que l'état persisté n'est pas relu. */
export function useService(): { etat: EtatService; pret: boolean } {
  const [e, setE] = React.useState(etat);
  const [pret, setPret] = React.useState(false);
  const [, tic] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    abonnes.add(setE);
    // L'état COURANT, pas la valeur figée au premier chargement : un écran monté après
    // « Démarrer ma journée » relisait sinon « hors service ».
    chargerService().then(() => { setE(etat); setPret(true); });
    return () => { abonnes.delete(setE); };
  }, []);
  // Le compteur de conduite avance : rafraîchir l'affichage chaque minute.
  React.useEffect(() => {
    if (!e.active) return;
    const id = setInterval(tic, 60_000);
    return () => clearInterval(id);
  }, [e.active]);
  return { etat: e, pret };
}

export function formatDuree(ms: number, lang: 'fr' | 'ar'): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (lang === 'ar') return h > 0 ? `${h} س ${m} د` : `${m} د`;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}
