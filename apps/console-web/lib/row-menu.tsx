'use client';
import * as React from 'react';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';

/**
 * Menu « … » d'une ligne de tableau, conçu pour héberger des dialogues.
 *
 * Deux défauts se cachaient dans le motif d'origine, et tous deux venaient du MENU, pas du
 * dialogue (anomalie AN-13, recette du 12/09) :
 *
 *  1. Les actions à dialogue déclarent `onSelect` + `preventDefault()` pour que le menu ne
 *     se ferme pas sous le clic — mais plus rien ne le refermait ensuite. Un menu Radix
 *     **modal** pose `pointer-events: none`, le verrou de défilement et `aria-hidden` sur
 *     toute la page : le menu survivait au dialogue et laissait une console entièrement
 *     morte, sans message, jusqu'au rechargement.
 *  2. Resté ouvert, le menu se repositionnait à chaque rafraîchissement des données.
 *
 * D'où : menu **non modal** (il ne verrouille plus rien) **et** refermé dès que le dialogue
 * qu'il a ouvert se referme — `useFermerMenu()` donne cette poignée aux dialogues enfants.
 */
const FermerMenu = React.createContext<() => void>(() => {});

/** À appeler par un dialogue enfant quand il se referme, pour refermer le menu porteur. */
export function useFermerMenu(): () => void {
  return React.useContext(FermerMenu);
}

export function RowMenu({ children, trigger }: { children: React.ReactNode; trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const fermer = React.useCallback(() => setOpen(false), []);
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger>
        {trigger ?? <IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <FermerMenu.Provider value={fermer}>{children}</FermerMenu.Provider>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
