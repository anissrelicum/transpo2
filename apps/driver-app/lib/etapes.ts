// Ce que le livreur fait à chaque étape d'une mission, et l'ouverture de la navigation.
//
// Les statuts « en route » (RETRAIT : vers le marchand, LIVRAISON : vers le client) sont
// posés par le geste naturel du livreur — toucher « Naviguer » — au lieu d'un bouton à
// part qu'il oubliait : le client est prévenu que le colis arrive au bon moment.
import { Linking, Platform } from 'react-native';
import type { Order, OrderStatus } from '@transpo/domain';
import { idemKey } from './api';
import { enqueue } from './outbox';

/** Avancée « en route » déclenchée par la navigation, selon le statut courant. */
const EN_ROUTE: Partial<Record<OrderStatus, true>> = { ASSIGNEE: true, RECUPEREE: true };

/** Met l'avancée en file (sur disque d'abord : elle survit à une coupure). */
export async function avancer(o: Order): Promise<void> {
  await enqueue({ kind: 'advance', ref: o.ref, from: o.status, idemKey: idemKey(o.ref, `advance-${o.status}`) });
}

export async function partirEnRoute(o: Order): Promise<boolean> {
  if (!EN_ROUTE[o.status]) return false;
  await avancer(o);
  return true;
}

/**
 * Ouvre la navigation. Ordre : le lien d'ORIGINE envoyé par le client (il peut désigner
 * une entrée précise), puis l'app de cartes du téléphone, puis Google Maps web.
 */
export async function ouvrirItineraire(lat: number | null, lng: number | null, lien: string | null, adresse: string): Promise<boolean> {
  const cible = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(adresse);
  const candidats = [
    lien && /^https?:\/\//i.test(lien) ? lien : null,
    Platform.OS === 'android' ? `google.navigation:q=${cible}` : `maps://?daddr=${cible}`,
    Platform.OS === 'android' ? `geo:0,0?q=${cible}` : null,
    `https://www.google.com/maps/dir/?api=1&destination=${cible}`,
  ].filter((u): u is string => !!u);
  for (const u of candidats) {
    try {
      await Linking.openURL(u);
      return true;
    } catch { /* candidat suivant */ }
  }
  return false;
}

export function appeler(tel: string): void {
  void Linking.openURL(`tel:${tel.replace(/[^\d+]/g, '')}`);
}
