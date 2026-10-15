// Validation de la localisation d'un point de course (coordonnées + lien de carte).
// Pure : utilisée par la création et la mise à jour d'une commande, testée sans base.
import { BadRequestException } from '@nestjs/common';
import { isLatitude, isLongitude, shareableMapUrl, MAP_URL_MAX } from '@transpo/domain';

export interface LocalisationPoint { lat: number | null; lng: number | null; mapUrl: string | null }
export const SANS_LOCALISATION: LocalisationPoint = { lat: null, lng: null, mapUrl: null };

const vide = (v: unknown) => v === undefined || v === null || v === '';

/**
 * Normalise la localisation d'un point :
 *  - latitude et longitude vont ENSEMBLE (une seule des deux ne situe rien) ;
 *  - lat ∈ [-90, 90], lng ∈ [-180, 180] ;
 *  - lien http(s) de 2048 caractères au plus, conservé tel quel ;
 *  - coordonnées sans lien → lien Google Maps partageable généré (le livreur doit
 *    toujours pouvoir lancer sa navigation d'un geste) ;
 *  - lien sans coordonnées → refusé : l'API ne va pas chercher de page pendant une
 *    création ; le client résout d'abord le lien (`POST /v1/geo/resolve-link`).
 */
export function normaliserLocalisation(
  point: 'retrait' | 'livraison', lat: unknown, lng: unknown, mapUrl: unknown,
): LocalisationPoint {
  const sansLat = vide(lat), sansLng = vide(lng), sansUrl = vide(mapUrl);
  if (sansLat && sansLng && sansUrl) return SANS_LOCALISATION;
  if (sansLat !== sansLng) {
    throw new BadRequestException(`Localisation (${point}) : latitude et longitude vont ensemble.`);
  }
  if (sansLat) {
    throw new BadRequestException(`Localisation (${point}) : lien de carte sans coordonnées — résolvez-le via POST /v1/geo/resolve-link.`);
  }
  if (!isLatitude(lat)) throw new BadRequestException(`Localisation (${point}) : latitude invalide (nombre entre -90 et 90).`);
  if (!isLongitude(lng)) throw new BadRequestException(`Localisation (${point}) : longitude invalide (nombre entre -180 et 180).`);
  let url: string;
  if (sansUrl) {
    url = shareableMapUrl(lat, lng);
  } else {
    if (typeof mapUrl !== 'string') throw new BadRequestException(`Localisation (${point}) : lien de carte invalide.`);
    url = mapUrl.trim();
    if (url.length > MAP_URL_MAX) {
      throw new BadRequestException(`Localisation (${point}) : lien de carte trop long (${MAP_URL_MAX} caractères au plus).`);
    }
    let u: URL;
    try { u = new URL(url); } catch { throw new BadRequestException(`Localisation (${point}) : lien de carte invalide.`); }
    // Le lien est ouvert tel quel sur le téléphone du livreur : ni `javascript:`, ni
    // `intent:`, ni fichier local — du web, et rien d'autre.
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      throw new BadRequestException(`Localisation (${point}) : seuls les liens http(s) sont acceptés.`);
    }
  }
  return { lat, lng, mapUrl: url };
}
