import fs from 'node:fs';
import path from 'node:path';
import { racineDuDepot } from './docs';

/**
 * Inventaire des preuves de recette, construit à partir du DISQUE au moment du rendu.
 *
 * Les verdicts sont versionnés (`qa/recette/<run>/RAPPORT.md`), les enregistrements ne le
 * sont pas : `.gitignore` exclut `*.webm`, `*.mp4`, `*.png` et les dossiers `videos/` et
 * `artefacts/` — 138 vidéos pèsent 147 Mo et gonfleraient le dépôt définitivement. Un
 * environnement cloné depuis Git n'a donc AUCUNE preuve binaire, et c'est normal : la liste
 * des cas vient du rapport, chaque ligne dit ensuite si son enregistrement est là ou non.
 */

export interface Preuve { fichier: string; format: 'webm' | 'mp4'; octets: number }
export interface CasRecette {
  id: string;
  titre: string;
  verdict: string;
  constat: string;
  preuves: Preuve[];
  captures: number;
}
export interface RunRecette {
  id: string;
  cas: CasRecette[];
  avecPreuve: number;
  captures: number;
}

const DOSSIER = () => path.join(racineDuDepot(), 'qa', 'recette');

/** Normalise une référence de cas : `tc-l03m` → `TC-L03m`. */
function normaliser(brut: string): string | null {
  const m = /^TC-([A-Za-z])(\d{1,3})([A-Za-z]?)$/.exec(brut.trim());
  if (!m) return null;
  return `TC-${m[1]!.toUpperCase()}${m[2]!.padStart(2, '0')}${m[3]!.toLowerCase()}`;
}

/** Première référence de cas trouvée dans un chemin (`videos/q02-TC-Q02-…/video.webm`). */
function casDuChemin(rel: string): string | null {
  const m = /TC-[A-Za-z]\d{1,3}[A-Za-z]?/.exec(rel);
  return m ? normaliser(m[0]) : null;
}

/** Titres des cas, lus une fois dans le plan de test (`**TC-XXX — Titre**`). */
function titresDuPlan(): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const src = fs.readFileSync(path.join(racineDuDepot(), 'PLAN-TEST-MANUEL.md'), 'utf8');
    for (const m of src.matchAll(/\*\*(TC-[A-Za-z]\d{1,3}[A-Za-z]?)\s*[—-]\s*([^*]+)\*\*/g)) {
      const id = normaliser(m[1]!);
      if (id && !out.has(id)) out.set(id, m[2]!.trim());
    }
  } catch { /* plan absent : on se rabattra sur le constat du rapport */ }
  return out;
}

/** Verdicts d'un run, lus dans les tableaux de son `RAPPORT.md`. */
function verdictsDuRapport(dossierRun: string): Map<string, { verdict: string; constat: string }> {
  const out = new Map<string, { verdict: string; constat: string }>();
  let src: string;
  try { src = fs.readFileSync(path.join(dossierRun, 'RAPPORT.md'), 'utf8'); } catch { return out; }
  for (const ligne of src.split('\n')) {
    if (!ligne.startsWith('|')) continue;
    const cellules = ligne.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const id = normaliser(cellules[0] ?? '');
    if (!id || out.has(id)) continue;
    out.set(id, { verdict: cellules[1] ?? '', constat: cellules[2] ?? '' });
  }
  return out;
}

/** Parcours récursif borné — les dossiers de run sont plats, deux niveaux suffisent. */
function fichiers(dir: string, base: string, profondeur = 0): string[] {
  if (profondeur > 3) return [];
  let entrees: fs.Dirent[];
  try { entrees = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out: string[] = [];
  for (const e of entrees) {
    const complet = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiers(complet, base, profondeur + 1));
    else out.push(path.relative(base, complet));
  }
  return out;
}

/** Tous les runs de recette présents sur le disque, du plus récent au plus ancien. */
export function chargerLesRuns(): RunRecette[] {
  const racine = DOSSIER();
  let dossiers: string[];
  try {
    dossiers = fs.readdirSync(racine, { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse();
  } catch {
    return [];
  }

  const titres = titresDuPlan();

  return dossiers.map((run) => {
    const dossierRun = path.join(racine, run);
    const verdicts = verdictsDuRapport(dossierRun);
    const tous = fichiers(dossierRun, dossierRun);

    const preuvesParCas = new Map<string, Preuve[]>();
    const capturesParCas = new Map<string, number>();
    for (const rel of tous) {
      const id = casDuChemin(rel);
      if (!id) continue;
      if (/\.png$/i.test(rel)) { capturesParCas.set(id, (capturesParCas.get(id) ?? 0) + 1); continue; }
      const ext = /\.(webm|mp4)$/i.exec(rel);
      if (!ext) continue;
      let octets = 0;
      try { octets = fs.statSync(path.join(dossierRun, rel)).size; } catch { continue; }
      const liste = preuvesParCas.get(id) ?? [];
      liste.push({ fichier: rel, format: ext[1]!.toLowerCase() as 'webm' | 'mp4', octets });
      preuvesParCas.set(id, liste);
    }

    // Les cas connus du rapport font foi ; un dossier présent sans ligne de rapport est
    // ajouté quand même — il porte une preuve que personne ne doit perdre de vue.
    const ids = new Set<string>([...verdicts.keys(), ...preuvesParCas.keys(), ...capturesParCas.keys()]);
    const cas: CasRecette[] = [...ids].sort().map((id) => {
      const v = verdicts.get(id);
      const preuves = (preuvesParCas.get(id) ?? []).sort((a, b) => a.fichier.localeCompare(b.fichier));
      return {
        id,
        titre: titres.get(id) ?? '',
        verdict: v?.verdict ?? '—',
        constat: v?.constat ?? '',
        preuves,
        captures: capturesParCas.get(id) ?? 0,
      };
    });

    return {
      id: run,
      cas,
      avecPreuve: cas.filter((c) => c.preuves.length > 0).length,
      captures: cas.reduce((a, c) => a + c.captures, 0),
    };
  });
}

/**
 * Chemin absolu d'un enregistrement, ou `null`.
 *
 * Le fichier demandé doit figurer dans l'inventaire du run : on ne compose jamais un
 * chemin à partir d'une chaîne reçue du client, on vérifie l'appartenance à une liste
 * construite côté serveur.
 */
export function cheminDeLaPreuve(run: string, fichier: string): string | null {
  const inventaire = chargerLesRuns().find((r) => r.id === run);
  if (!inventaire) return null;
  const connu = inventaire.cas.some((c) => c.preuves.some((p) => p.fichier === fichier));
  if (!connu) return null;
  return path.join(DOSSIER(), run, fichier);
}
