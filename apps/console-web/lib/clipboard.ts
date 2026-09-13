'use client';

/**
 * Copie dans le presse-papiers. Hors contexte sécurisé (HTTP), `navigator.clipboard`
 * est undefined : repli sur une textarea temporaire + execCommand('copy').
 * Renvoie false si la copie a échoué — l'appelant affiche alors un feedback d'erreur.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
