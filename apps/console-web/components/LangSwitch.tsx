'use client';
import * as React from 'react';
import { DropdownMenu, IconButton, Tooltip } from '@radix-ui/themes';
import { GlobeIcon, CheckIcon } from '@radix-ui/react-icons';
import { LANGS, LANG_LABEL, type Lang } from '@transpo/i18n';

/**
 * Bascule de langue. Le choix est posé en cookie côté serveur puis la page est
 * rechargée en dur : le rendu serveur doit repartir dans la bonne langue et la
 * bonne direction, un simple re-rendu client laisserait `dir` inchangé.
 */
export function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  const [busy, setBusy] = React.useState(false);

  async function choose(next: Lang) {
    if (next === lang) return;
    setBusy(true);
    await fetch('/api/lang', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang: next }),
    });
    window.location.reload();
  }

  return (
    <DropdownMenu.Root>
      <Tooltip content={label}>
        <DropdownMenu.Trigger>
          <IconButton variant="ghost" color="gray" size="2" disabled={busy} aria-label={label}>
            <GlobeIcon />
          </IconButton>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Content align="end">
        {LANGS.map((l) => (
          <DropdownMenu.Item key={l} onSelect={() => choose(l)}>
            {l === lang ? <CheckIcon /> : <span style={{ width: 15, display: 'inline-block' }} />}
            {LANG_LABEL[l]}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
