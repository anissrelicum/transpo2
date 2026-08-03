import * as React from 'react';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { authedClient } from './api';

/**
 * Remontée de position du livreur.
 *
 * Volontairement **sans file d'attente** : une position est périmée dès la
 * suivante. Un envoi qui échoue est abandonné, pas rejoué — accumuler des
 * points hors ligne remplirait le stockage pour reconstituer un trajet passé
 * dont le PC flotte n'a que faire, lui qui n'affiche que la dernière position.
 *
 * Suivi **au premier plan uniquement** : le suivi en arrière-plan demande une
 * déclaration spécifique côté stores et un consentement distinct.
 */

const MIN_INTERVAL_MS = 30_000;
const MIN_DISTANCE_M = 50;

export type TrackingState = 'off' | 'starting' | 'on' | 'denied' | 'error';

export function useTracking(enabled: boolean) {
  const [state, setState] = React.useState<TrackingState>('off');
  const [lastAt, setLastAt] = React.useState<string | null>(null);
  const sub = React.useRef<Location.LocationSubscription | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function start() {
      setState('starting');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!perm.granted) { setState('denied'); return; }
      try {
        sub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: MIN_INTERVAL_MS, distanceInterval: MIN_DISTANCE_M },
          async (pos) => {
            try {
              const r = await authedClient().pushDriverPosition(pos.coords.latitude, pos.coords.longitude);
              setLastAt(r.at);
            } catch {
              // Hors ligne ou serveur indisponible : on laisse tomber ce point,
              // le suivant partira. Rien à rejouer.
            }
          },
        );
        if (!cancelled) setState('on');
      } catch {
        if (!cancelled) setState('error');
      }
    }

    function stop() {
      sub.current?.remove();
      sub.current = null;
      setState('off');
    }

    if (enabled) start(); else stop();

    // Le suivi n'a de sens qu'app ouverte : on relâche le capteur en arrière-plan.
    const appSub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') { sub.current?.remove(); sub.current = null; }
      else if (enabled && !sub.current) start();
    });

    return () => { cancelled = true; appSub.remove(); sub.current?.remove(); sub.current = null; };
  }, [enabled]);

  return { state, lastAt };
}
