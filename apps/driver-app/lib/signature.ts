export type Point = { x: number; y: number };

/**
 * Sérialisation de la signature. Volontairement **sans dépendance native** :
 * la logique reste vérifiable hors appareil (et l'API accepte `image/svg+xml`,
 * ce qui évite de rastériser une vue — donc un module natif de plus).
 */

/** Chemin SVG d'un trait. */
export function strokePath(stroke: Point[]): string {
  return stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** Data URI SVG des traits, sur fond blanc, aux dimensions de la zone de dessin. */
export function signatureToDataUri(strokes: Point[][], width: number, height: number): string {
  const paths = strokes
    .filter((s) => s.length > 1)
    .map((s) => `<path d="${strokePath(s)}" fill="none" stroke="#141E3C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('');
  const w = Math.round(width);
  const h = Math.round(height);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>${paths}</svg>`;
  // btoa n'accepte que du latin-1 ; le SVG produit ici est strictement ASCII.
  return `data:image/svg+xml;base64,${globalThis.btoa(svg)}`;
}

/** Un trait de deux points n'est pas une signature — évite de valider un effleurement. */
export function isSignatureMeaningful(strokes: Point[][]): boolean {
  return strokes.reduce((n, s) => n + s.length, 0) >= 8;
}
