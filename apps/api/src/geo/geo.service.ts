import {
  Injectable, NotFoundException, BadRequestException, UnprocessableEntityException, BadGatewayException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resoudreLien, ErreurLienCarte, type ResolutionLien } from './resolution-lien.js';
import { adresseDe, geocoder } from './nominatim.js';

/** Réponse de `POST /v1/geo/resolve-link`. */
export interface LienResolu extends ResolutionLien {
  /** Adresse lisible du point (Nominatim), absente si le service n'a pas répondu. */
  adresse?: string;
}

export interface Commune { name: string; iso: string }
export interface Province { province: string; communes: Commune[] }
export interface RegionNode { region: string; provinces: Province[] }
export interface CommuneShape { center: [number, number]; polygon: [number, number][] }

// Découpage administratif du Maroc (12 régions / 75 provinces / 1540 communes)
// dérivé du GeoPackage HCP + noms de provinces geoBoundaries. Chargé une fois en mémoire.
@Injectable()
export class GeoService {
  private readonly regions: RegionNode[] = JSON.parse(
    readFileSync(new URL('./data/morocco-admin.json', import.meta.url), 'utf8'),
  );
  private readonly shapes: Record<string, CommuneShape> = JSON.parse(
    readFileSync(new URL('./data/morocco-communes-geo.json', import.meta.url), 'utf8'),
  );

  listRegions(): RegionNode[] {
    return this.regions;
  }

  communeShape(iso: string): CommuneShape {
    const s = this.shapes[iso];
    if (!s) throw new NotFoundException(`Commune inconnue : ${iso}`);
    return s;
  }

  /**
   * Lien de localisation → position. Les erreurs portent un `code` stable que l'interface
   * traduit (FR/AR) ; le `message` français reste lisible pour un intégrateur d'API.
   */
  async resolveLink(texte: string, langue: 'fr' | 'ar' = 'fr'): Promise<LienResolu> {
    let r: ResolutionLien;
    try {
      r = await resoudreLien(texte, { geocoder });
    } catch (e) {
      if (!(e instanceof ErreurLienCarte)) throw e;
      const corps = { code: e.code, message: e.message };
      if (e.code === 'LIEN_VIDE') throw new BadRequestException(corps);
      if (e.code === 'INJOIGNABLE') throw new BadGatewayException(corps);
      throw new UnprocessableEntityException(corps);
    }
    // L'adresse est un confort : un Nominatim lent ou en panne ne fait jamais échouer l'appel.
    const adresse = await adresseDe(r.lat, r.lng, langue);
    return adresse ? { ...r, adresse } : r;
  }
}
