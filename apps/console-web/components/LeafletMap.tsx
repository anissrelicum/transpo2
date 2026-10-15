'use client';
import * as React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { useAppTheme } from './theme-provider';

export type MapMarker = {
  id: string; lat: number; lng: number; kind: 'driver' | 'order' | 'stop';
  label: string; sub?: string; color?: string; ini?: string;
  /** Épingle déplaçable à la souris / au doigt ; `onDragEnd` reçoit la nouvelle position. */
  draggable?: boolean; onDragEnd?: (lat: number, lng: number) => void;
};
export type MapCircle = { id: string; lat: number; lng: number; radiusM: number; color: string; label?: string; selected?: boolean };
export type MapPolygon = { id: string; latlngs: [number, number][]; color: string; label?: string; selected?: boolean; onClick?: () => void };
export type MapPolyline = { id: string; latlngs: [number, number][]; color: string; dashArray?: string };

// Icône livreur (pastille avec initiales) ou commande (goutte).
function makeIcon(m: MapMarker): L.DivIcon {
  const color = m.color || (m.kind === 'driver' ? 'indigo' : 'blue');
  if (m.kind === 'stop') {
    const html = `<div style="width:28px;height:28px;border-radius:50%;background:var(--${color}-9);box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid var(--color-panel-solid,#fff);display:flex;align-items:center;justify-content:center;font:700 13px system-ui;color:#fff">${m.ini || ''}</div>`;
    return L.divIcon({ html, className: 'tp-marker', iconSize: [28, 28], iconAnchor: [14, 14] });
  }
  const html = m.kind === 'driver'
    ? `<div style="width:38px;height:38px;border-radius:50%;background:var(--color-panel-solid,#fff);box-shadow:0 2px 8px rgba(0,0,0,.25);border:2.5px solid var(--${color}-9);display:flex;align-items:center;justify-content:center;font:600 12px system-ui;color:var(--${color}-11)">${m.ini || ''}</div>`
    : `<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--${color}-9);box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid var(--color-panel-solid,#fff)"></div>`;
  const size = m.kind === 'driver' ? 38 : 20;
  return L.divIcon({
    html, className: 'tp-marker',
    iconSize: [size, size],
    iconAnchor: m.kind === 'driver' ? [size / 2, size / 2] : [size / 2, size],
  });
}

// Les fonds CARTO exigent une clé Basemaps depuis septembre 2026 (sans elle, chaque tuile
// affiche « API KEY REQUIRED »). Clé injectée au build ; à défaut, repli sur OSM, assombri
// par filtre CSS en thème sombre faute de fond sombre OSM.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY;

function TileByTheme() {
  const { appearance } = useAppTheme();
  if (CARTO_KEY) {
    const style = appearance === 'dark' ? 'dark_all' : 'rastertiles/voyager';
    return (
      <TileLayer
        url={`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`}
        subdomains="abcd" maxZoom={20} attribution="&copy; OpenStreetMap, &copy; CARTO"
      />
    );
  }
  return (
    <>
    <style>{'.tp-tiles-dark{filter:invert(1) hue-rotate(180deg) brightness(.9) contrast(.9)}'}</style>
    <TileLayer
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
      attribution="&copy; OpenStreetMap"
      className={appearance === 'dark' ? 'tp-tiles-dark' : undefined}
    />
    </>
  );
}

function ZoomExpose({ onMap }: { onMap: (m: L.Map) => void }) {
  const map = useMap();
  React.useEffect(() => { onMap(map); setTimeout(() => map.invalidateSize(), 60); }, [map, onMap]);
  return null;
}

/**
 * Recadre la carte quand `focus` change (épingle posée depuis un lien collé) ou l'ajuste
 * pour contenir tous les points de `fit` (fiche commande : retrait + livraison).
 * `MapContainer` ignore les changements de `center` après le montage : sans ce composant,
 * l'épingle tomberait hors de l'écran.
 */
function Recadrer({ focus, focusZoom, fit }: { focus?: [number, number] | null; focusZoom?: number; fit?: [number, number][] }) {
  const map = useMap();
  const cleFocus = focus ? focus.join(',') : '';
  const cleFit = fit ? fit.map((p) => p.join(',')).join(';') : '';
  React.useEffect(() => {
    if (!focus) return;
    // Vue de détail (≥ 15) : on ne dézoome pas un utilisateur qui s'est rapproché pour
    // ajuster l'épingle. Vue d'ensemble (ville) : le zoom demandé s'applique tel quel.
    const z = focusZoom ?? map.getZoom();
    map.setView(focus, z >= 15 ? Math.max(z, map.getZoom()) : z);
  }, [cleFocus]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (fit && fit.length > 1) map.fitBounds(L.latLngBounds(fit), { padding: [36, 36], maxZoom: 16 });
    else if (fit && fit.length === 1) map.setView(fit[0], 16);
  }, [cleFit]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickCapture({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function LeafletMap({
  center, zoom = 12, markers = [], circles = [], polygons = [], polylines = [], interactive = true, onMap, onMapClick,
  focus, focusZoom, fit,
}: {
  center: [number, number]; zoom?: number; markers?: MapMarker[]; circles?: MapCircle[]; polygons?: MapPolygon[]; polylines?: MapPolyline[];
  interactive?: boolean; onMap?: (m: L.Map) => void; onMapClick?: (lat: number, lng: number) => void;
  focus?: [number, number] | null; focusZoom?: number; fit?: [number, number][];
}) {
  return (
    <MapContainer
      center={center} zoom={zoom} zoomControl={false} attributionControl={false}
      dragging={interactive} scrollWheelZoom={interactive} doubleClickZoom={interactive}
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
    >
      <TileByTheme />
      {onMap && <ZoomExpose onMap={onMap} />}
      {onMapClick && <ClickCapture onClick={onMapClick} />}
      {(focus !== undefined || fit) && <Recadrer focus={focus} focusZoom={focusZoom} fit={fit} />}
      {polylines.map((pl) => (
        <Polyline key={pl.id} positions={pl.latlngs}
          pathOptions={{ color: `var(--${pl.color}-9)`, weight: 4, opacity: 0.75, dashArray: pl.dashArray, lineJoin: 'round' }} />
      ))}
      {polygons.map((p) => (
        <Polygon key={p.id} positions={p.latlngs}
          eventHandlers={p.onClick ? { click: p.onClick } : undefined}
          pathOptions={{ color: `var(--${p.color}-9)`, weight: p.selected ? 3 : 1.5, dashArray: p.selected ? undefined : '5 5', fillColor: `var(--${p.color}-9)`, fillOpacity: 0.2 }}>
          {p.label && <Popup>{p.label}</Popup>}
        </Polygon>
      ))}
      {circles.map((c) => (
        <Circle key={c.id} center={[c.lat, c.lng]} radius={c.radiusM}
          pathOptions={{ color: `var(--${c.color}-9)`, weight: c.selected ? 3 : 1.5, dashArray: c.selected ? undefined : '5 5', fillColor: `var(--${c.color}-9)`, fillOpacity: 0.18 }}>
          {c.label && <Popup>{c.label}</Popup>}
        </Circle>
      ))}
      {markers.map((m) => (
        <Marker
          key={m.id} position={[m.lat, m.lng]} icon={makeIcon(m)}
          draggable={!!m.draggable}
          eventHandlers={m.onDragEnd ? {
            dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); m.onDragEnd!(p.lat, p.lng); },
          } : undefined}
        >
          <Popup>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
            {m.sub && <div style={{ color: 'var(--gray-11)', fontSize: 12, marginTop: 2 }}>{m.sub}</div>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
