// Dates d'exploitation à l'heure du Maroc : la journée et le mois comptables d'un transporteur
// ne basculent pas à minuit UTC.
const FUSEAU = 'Africa/Casablanca';

/** Jour courant, `AAAA-MM-JJ`. */
export function jourCourant(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Période comptable courante, `AAAA-MM`. */
export function periodeCourante(d = new Date()): string {
  return jourCourant(d).slice(0, 7);
}
