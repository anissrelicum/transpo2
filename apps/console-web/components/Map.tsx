'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import type { MapMarker, MapCircle, MapPolygon, MapPolyline } from './LeafletMap';

// Leaflet requiert `window` → chargé uniquement côté client (pas de SSR).
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div style={{ position: 'absolute', inset: 0, background: 'var(--gray-a2)' }} />,
});

export type { MapMarker, MapCircle, MapPolygon, MapPolyline };

export function Map(props: {
  center: [number, number]; zoom?: number; markers?: MapMarker[]; circles?: MapCircle[]; polygons?: MapPolygon[]; polylines?: MapPolyline[];
  interactive?: boolean; onMap?: (m: any) => void; onMapClick?: (lat: number, lng: number) => void;
}) {
  return <LeafletMap {...props} />;
}
