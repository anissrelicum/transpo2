'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import type { MapMarker, MapCircle } from './LeafletMap';

// Leaflet requiert `window` → chargé uniquement côté client (pas de SSR).
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div style={{ position: 'absolute', inset: 0, background: 'var(--gray-a2)' }} />,
});

export type { MapMarker, MapCircle };

export function Map(props: {
  center: [number, number]; zoom?: number; markers?: MapMarker[]; circles?: MapCircle[];
  interactive?: boolean; onMap?: (m: any) => void;
}) {
  return <LeafletMap {...props} />;
}
