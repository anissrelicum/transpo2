/**
 * Rendu Markdown maison — volontairement minimal.
 *
 * La consigne était de ne rien installer : ce module couvre exactement ce que la
 * documentation de `docs/produit/` utilise (titres, paragraphes, listes, tableaux,
 * blocs de code, citations, filets) et rien de plus. Il produit des données PLATES,
 * sérialisables, pour qu'un composant serveur puisse les passer au composant client
 * qui porte la recherche — un arbre de nœuds React ne traverserait pas cette frontière.
 *
 * Le rendu des marques en ligne (gras, italique, code, liens) se fait au moment
 * d'afficher, dans `DocsView` : c'est une fonction pure sur une chaîne, inutile de la
 * pré-mâcher ici.
 */

export type Bloc =
  | { t: 'titre'; niveau: number; texte: string; id: string }
  | { t: 'para'; texte: string }
  | { t: 'liste'; ordonnee: boolean; items: string[] }
  | { t: 'code'; code: string }
  | { t: 'tableau'; entetes: string[]; lignes: string[][] }
  | { t: 'citation'; texte: string }
  | { t: 'filet' };

/** Identifiant d'ancre : sans accent, sans marque Markdown, sans ponctuation. */
export function ancre(texte: string): string {
  return texte
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

/** Texte brut d'un bloc — c'est lui que la recherche interroge. */
export function texteDuBloc(b: Bloc): string {
  switch (b.t) {
    case 'titre': return b.texte;
    case 'para': return b.texte;
    case 'citation': return b.texte;
    case 'code': return b.code;
    case 'liste': return b.items.join(' ');
    case 'tableau': return [...b.entetes, ...b.lignes.flat()].join(' ');
    default: return '';
  }
}

const ligneDeTableau = (l: string): string[] =>
  l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

const estSeparateur = (l: string): boolean => /^\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-');

/** Analyse un document Markdown en blocs. */
export function analyser(source: string): Bloc[] {
  const lignes = source.replace(/\r\n/g, '\n').split('\n');
  const blocs: Bloc[] = [];
  let i = 0;

  while (i < lignes.length) {
    const ligne = lignes[i]!;

    if (!ligne.trim()) { i += 1; continue; }

    // Bloc de code clôturé. Un bloc non refermé va jusqu'à la fin du fichier
    // plutôt que d'avaler le reste en paragraphes.
    if (ligne.startsWith('```')) {
      const corps: string[] = [];
      i += 1;
      while (i < lignes.length && !lignes[i]!.startsWith('```')) { corps.push(lignes[i]!); i += 1; }
      i += 1;
      blocs.push({ t: 'code', code: corps.join('\n') });
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(ligne.trim())) { blocs.push({ t: 'filet' }); i += 1; continue; }

    const titre = /^(#{1,6})\s+(.*)$/.exec(ligne);
    if (titre) {
      const texte = titre[2]!.trim();
      blocs.push({ t: 'titre', niveau: titre[1]!.length, texte, id: ancre(texte) });
      i += 1;
      continue;
    }

    // Tableau : une ligne d'en-tête suivie d'une ligne de séparation.
    if (ligne.includes('|') && i + 1 < lignes.length && estSeparateur(lignes[i + 1]!)) {
      const entetes = ligneDeTableau(ligne);
      i += 2;
      const rangs: string[][] = [];
      while (i < lignes.length && lignes[i]!.includes('|') && lignes[i]!.trim()) {
        rangs.push(ligneDeTableau(lignes[i]!));
        i += 1;
      }
      blocs.push({ t: 'tableau', entetes, lignes: rangs });
      continue;
    }

    if (/^>\s?/.test(ligne)) {
      const corps: string[] = [];
      while (i < lignes.length && /^>\s?/.test(lignes[i]!)) {
        corps.push(lignes[i]!.replace(/^>\s?/, ''));
        i += 1;
      }
      blocs.push({ t: 'citation', texte: corps.join(' ').replace(/\s+/g, ' ').trim() });
      continue;
    }

    const puce = /^[-*]\s+(.*)$/.exec(ligne);
    const numero = /^\d+[.)]\s+(.*)$/.exec(ligne);
    if (puce || numero) {
      const ordonnee = !!numero;
      const items: string[] = [];
      while (i < lignes.length) {
        const l = lignes[i]!;
        const m = ordonnee ? /^\d+[.)]\s+(.*)$/.exec(l) : /^[-*]\s+(.*)$/.exec(l);
        if (m) { items.push(m[1]!.trim()); i += 1; continue; }
        // Continuation d'item : ligne indentée sous la puce précédente.
        if (items.length && /^\s{2,}\S/.test(l)) { items[items.length - 1] += ` ${l.trim()}`; i += 1; continue; }
        break;
      }
      blocs.push({ t: 'liste', ordonnee, items });
      continue;
    }

    // Paragraphe : jusqu'à la ligne vide ou le prochain bloc structuré.
    const corps: string[] = [];
    while (i < lignes.length) {
      const l = lignes[i]!;
      if (!l.trim()) break;
      if (/^(#{1,6}\s|>\s?|```|[-*]\s|\d+[.)]\s)/.test(l) || /^(-{3,}|\*{3,})$/.test(l.trim())) break;
      if (l.includes('|') && i + 1 < lignes.length && estSeparateur(lignes[i + 1]!)) break;
      corps.push(l.trim());
      i += 1;
    }
    if (corps.length) blocs.push({ t: 'para', texte: corps.join(' ') });
  }

  return blocs;
}

/** Fragment en ligne : ce que `DocsView` sait afficher. */
export type Fragment =
  | { t: 'texte'; v: string }
  | { t: 'gras'; v: string }
  | { t: 'ital'; v: string }
  | { t: 'code'; v: string }
  | { t: 'lien'; v: string; href: string };

const MARQUES = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;

/** Découpe une chaîne en fragments (gras, italique, code, lien). */
export function fragments(texte: string): Fragment[] {
  const out: Fragment[] = [];
  let dernier = 0;
  for (const m of texte.matchAll(MARQUES)) {
    const debut = m.index ?? 0;
    if (debut > dernier) out.push({ t: 'texte', v: texte.slice(dernier, debut) });
    const jeton = m[0]!;
    if (jeton.startsWith('**')) out.push({ t: 'gras', v: jeton.slice(2, -2) });
    else if (jeton.startsWith('`')) out.push({ t: 'code', v: jeton.slice(1, -1) });
    else if (jeton.startsWith('[')) {
      const lien = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(jeton);
      if (lien) out.push({ t: 'lien', v: lien[1]!, href: lien[2]! });
      else out.push({ t: 'texte', v: jeton });
    } else out.push({ t: 'ital', v: jeton.slice(1, -1) });
    dernier = debut + jeton.length;
  }
  if (dernier < texte.length) out.push({ t: 'texte', v: texte.slice(dernier) });
  return out;
}
