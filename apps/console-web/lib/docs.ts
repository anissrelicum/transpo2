import fs from 'node:fs';
import path from 'node:path';
import { analyser, texteDuBloc, type Bloc } from './markdown';

/**
 * Lecture serveur de la documentation produit (`docs/produit/*.md`).
 *
 * Les fichiers sont lus sur le disque au rendu, jamais importés ni embarqués : on
 * documente le produit dans des Markdown que l'on peut relire et diffuser hors console,
 * et la page ne fait que les afficher. L'image Docker embarque tout le dépôt
 * (`COPY . .`), ces fichiers sont donc présents en production.
 */

export interface Section { id: string; titre: string; blocs: Bloc[]; texte: string }
export interface PageDoc { slug: string; titre: string; intro: Bloc[]; sections: Section[]; texte: string }

/** Racine du mono-repo — `process.cwd()` vaut `apps/console-web` au démarrage de Next. */
export function racineDuDepot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const DOSSIER = () => path.join(racineDuDepot(), 'docs', 'produit');

/** Découpe les blocs d'un document en sections de niveau 2. */
function decouper(blocs: Bloc[]): { titre: string; intro: Bloc[]; sections: Section[] } {
  let titre = '';
  const intro: Bloc[] = [];
  const sections: Section[] = [];
  let courante: Section | null = null;

  for (const b of blocs) {
    if (b.t === 'titre' && b.niveau === 1 && !titre) { titre = b.texte; continue; }
    if (b.t === 'titre' && b.niveau <= 2) {
      courante = { id: b.id, titre: b.texte, blocs: [b], texte: '' };
      sections.push(courante);
      continue;
    }
    if (courante) courante.blocs.push(b);
    else intro.push(b);
  }

  for (const s of sections) s.texte = s.blocs.map(texteDuBloc).join(' ').toLowerCase();
  return { titre, intro, sections };
}

/** Toutes les pages de `docs/produit/`, dans l'ordre de leur nom de fichier. */
export function chargerLesPages(): PageDoc[] {
  const dossier = DOSSIER();
  let fichiers: string[];
  try {
    fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return []; // documentation absente de cet environnement : la page le dira.
  }

  return fichiers.map((f) => {
    const slug = f.replace(/\.md$/, '');
    const source = fs.readFileSync(path.join(dossier, f), 'utf8');
    const { titre, intro, sections } = decouper(analyser(source));
    return {
      slug,
      titre: titre || slug,
      intro,
      sections,
      texte: `${titre} ${sections.map((s) => s.texte).join(' ')}`.toLowerCase(),
    };
  });
}
