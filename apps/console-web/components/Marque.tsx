import * as React from 'react';
import { Flex, Text } from '@radix-ui/themes';

/**
 * Marque Portrail : symbole validé (design/marque/symbole.svg) + nom. Le symbole porte son
 * propre fond marine, lisible en clair comme en sombre.
 */
export function Marque({ taille = 30, sousTitre, nomTaille = '3' }: {
  taille?: number;
  sousTitre?: React.ReactNode;
  nomTaille?: '3' | '4' | '6' | '7';
}) {
  return (
    <Flex align="center" gap="2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/symbole.svg" alt="" width={taille} height={taille}
        style={{ borderRadius: Math.round(taille * 0.22), flexShrink: 0, display: 'block' }} />
      <div>
        <Text as="div" weight="bold" size={nomTaille} style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>Portrail</Text>
        {sousTitre ? <Text as="div" size="1" color="gray">{sousTitre}</Text> : null}
      </div>
    </Flex>
  );
}
