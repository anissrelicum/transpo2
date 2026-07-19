import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'node:fs';

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
}
