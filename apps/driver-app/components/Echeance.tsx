// Échéance d'un arrêt (ADR 0006) : « Avant 12:00 · 23 min », orange sous 15 min, rouge en retard.
import * as React from 'react';
import { describeDelay, type DelayMode } from '@transpo/domain';
import { Pastille } from './ui';

/** « 45 min », « 2 h 05 », « 3 j 4 h » : un retard de plusieurs jours reste lisible. */
function duree(min: number, lang: 'fr' | 'ar'): string {
  const [j, h, m] = [Math.floor(min / 1440), Math.floor((min % 1440) / 60), min % 60];
  if (lang === 'ar') return j > 0 ? `${j} ي ${h} س` : h > 0 ? `${h} س ${m} د` : `${m} د`;
  return j > 0 ? `${j} j ${h} h` : h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/** Heure courante rafraîchie toutes les 20 s. */
export function useMaintenant(): number {
  const [t, setT] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  return t;
}

const L = {
  fr: { avant: (h: string) => `Avant ${h}`, retard: (m: number) => `En retard de ${duree(m, 'fr')}`, min: (m: number) => `${m} min`, auRetrait: 'Délai au retrait' },
  ar: { avant: (h: string) => `قبل ${h}`, retard: (m: number) => `متأخر ${duree(m, 'ar')}`, min: (m: number) => `${m} د`, auRetrait: 'المهلة عند الاستلام' },
};

/**
 * `echeance` : échéance ISO de l'arrêt, ou `null`. Sans échéance mais avec un délai « après
 * retrait », on rappelle la règle (le compte à rebours démarrera au retrait).
 */
export function Echeance({ echeance, delayMode, delayMinutes, lang }: {
  echeance: string | null | undefined; delayMode?: string | null; delayMinutes?: number | null; lang: 'fr' | 'ar';
}) {
  const now = useMaintenant();
  const t = L[lang];
  if (!echeance) {
    if (delayMode === 'apres_retrait' && delayMinutes) {
      return <Pastille ton="ambre">{describeDelay({ mode: delayMode as DelayMode, minutes: delayMinutes }, lang)}</Pastille>;
    }
    return null;
  }
  const d = new Date(echeance);
  const reste = Math.round((d.getTime() - now) / 60_000);
  const heure = d.toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (reste < 0) return <Pastille ton="rouge" point>{t.retard(-reste)}</Pastille>;
  return (
    <Pastille ton={reste <= 15 ? 'rouge' : reste <= 60 ? 'ambre' : 'gris'} point={reste <= 60}>
      {reste <= 60 ? `${t.avant(heure)} · ${t.min(reste)}` : t.avant(heure)}
    </Pastille>
  );
}
