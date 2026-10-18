// Signal « une proposition vient d'arriver » : émis par le module push (notification reçue
// ou touchée), écouté par l'écran Missions pour recharger les propositions sans attendre
// sa relecture périodique. Aucun état : un simple bus local.
const ecouteurs = new Set<() => void>();

export function signalerProposition(): void {
  for (const fn of ecouteurs) fn();
}

export function ecouterPropositions(fn: () => void): () => void {
  ecouteurs.add(fn);
  return () => { ecouteurs.delete(fn); };
}
