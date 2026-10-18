// Icônes de la refonte (mêmes tracés que la maquette validée, grille 24 px, trait 2).
import * as React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type P = { size?: number; color: string };

function Trait({ size = 24, color, children }: P & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const IcCarte = (p: P) => <Trait {...p}><Path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><Path d="M9 4v14M15 6v14" /></Trait>;
export const IcListe = (p: P) => <Trait {...p}><Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Trait>;
export const IcScan = (p: P) => <Trait {...p}><Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" /></Trait>;
export const IcCaisse = (p: P) => <Trait {...p}><Rect x={2} y={6} width={20} height={13} rx={2} /><Circle cx={12} cy={12.5} r={2.5} /><Path d="M6 10h.01M18 15h.01" /></Trait>;
export const IcProfil = (p: P) => <Trait {...p}><Circle cx={12} cy={8} r={4} /><Path d="M4 21a8 8 0 0 1 16 0" /></Trait>;
export const IcTel = (p: P) => <Trait {...p}><Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></Trait>;
export const IcPin = (p: P) => <Trait {...p}><Path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><Circle cx={12} cy={10} r={2.5} /></Trait>;
export const IcCheck = (p: P) => <Svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12.5 10 17l9-10" /></Svg>;
export const IcAlerte = (p: P) => <Trait {...p}><Path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Trait>;
export const IcHorsReseau = (p: P) => <Trait {...p}><Path d="M2 2l20 20M17.5 17H7a5 5 0 0 1-1.6-9.7M9.5 5.4A7 7 0 0 1 20 11a4 4 0 0 1 1 7.6" /></Trait>;
export const IcPhoto = (p: P) => <Trait {...p}><Path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><Circle cx={12} cy={13} r={3.5} /></Trait>;
export const IcRetour = (p: P) => <Trait {...p}><Path d="M15 18l-6-6 6-6" /></Trait>;
export const IcCloche = (p: P) => <Trait {...p}><Path d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S7 14 7 10Z" /><Path d="M10.3 18.5a1.9 1.9 0 0 0 3.4 0" /></Trait>;
export const IcCentrer = (p: P) => <Trait {...p}><Circle cx={12} cy={12} r={3} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Trait>;
export function IcNaviguer({ size = 24, color }: P) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" /></Svg>;
}
