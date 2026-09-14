import * as React from 'react';
import { chargerLesPages } from '../../../lib/docs';
import { chargerLesRuns } from '../../../lib/recette';
import { DocsView } from '../../../components/DocsView';

export const dynamic = 'force-dynamic';

/**
 * Documentation produit.
 *
 * Tout est lu côté SERVEUR : les Markdown de `docs/produit/` et l'inventaire des preuves
 * de recette sur le disque. Aucune dépendance de rendu Markdown n'est installée — le
 * fichier est analysé en blocs plats (`lib/markdown.ts`) que le composant client affiche
 * avec les composants Radix de la plateforme.
 *
 * `force-dynamic` n'est pas un choix : le layout de l'espace lit les cookies, donc la page
 * est de toute façon rendue à la requête. C'est ce qui permet à l'inventaire des preuves
 * de refléter l'état réel du disque plutôt que celui du jour de la construction.
 */
export default function DocsPage() {
  return <DocsView pages={chargerLesPages()} runs={chargerLesRuns()} />;
}
