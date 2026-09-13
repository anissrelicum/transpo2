'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * `router.refresh()` différé d'un tour de boucle d'affichage.
 *
 * Rafraîchir pendant que Radix démonte un dialogue re-rend l'arbre sous les pieds de son
 * nettoyage : `pointer-events: none`, le verrou de défilement (`data-scroll-locked`) et
 * l'`aria-hidden` posé sur la racine `.radix-themes` restent alors collés à une console
 * qui n'est plus cliquable du tout, sans le moindre message (anomalie AN-13, constatée
 * sur /users, /saas et /drivers pendant la recette du 12/09).
 *
 * Deux règles vont ensemble et se complètent :
 *   1. le bouton d'un dialogue **attend** la mutation, **puis** ferme le dialogue ;
 *   2. le rafraîchissement des données n'est demandé qu'à la boucle suivante — ici.
 *
 * `restaurerInterface()` est le filet de sécurité : si, malgré tout, la page se retrouve
 * verrouillée alors qu'aucun dialogue n'est ouvert, on rend la main à l'utilisateur
 * plutôt que de le laisser devant une console morte.
 */
export function useSafeRefresh(): () => void {
  const router = useRouter();
  return React.useCallback(() => {
    requestAnimationFrame(() => {
      router.refresh();
      requestAnimationFrame(restaurerInterface);
    });
  }, [router]);
}

/** Lève un verrou d'interface résiduel quand plus aucun dialogue n'est ouvert. */
export function restaurerInterface(): void {
  if (typeof document === 'undefined') return;
  // Un dialogue OU un menu encore ouvert a de bonnes raisons de tenir le verrou.
  if (document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"]')) return;
  const body = document.body;
  if (getComputedStyle(body).pointerEvents === 'none') body.style.pointerEvents = '';
  body.removeAttribute('data-scroll-locked');
  document.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
    // Seuls les conteneurs masqués par Radix pour isoler un dialogue sont concernés :
    // une icône décorative, elle, porte légitimement aria-hidden en permanence.
    if (el.querySelector('main,table,[role="menu"],header')) el.removeAttribute('aria-hidden');
  });
}
