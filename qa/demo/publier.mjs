// Publie les vidéos de démo dans la console SaaS (onglet « Démos »).
//
// Copie chaque chapitre rendu par qa/demo/ vers apps/console-web/demos/, avec son affiche
// (une image représentative) et ses sous-titres convertis en WebVTT. Le dossier n'est pas
// versionné ; il entre dans l'image de la console au build (COPY . .).
//
//   node qa/demo/publier.mjs
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '../..');
const SOURCE = path.join(RACINE, 'qa/demo/sortie');
const CIBLE = path.join(RACINE, 'apps/console-web/demos');

// Instant de l'affiche : un écran parlant de chaque chapitre, pas son carton de titre.
const AFFICHES = {
  'transpo-demo-complete': 4, '00-decouvrir': 25, '01-plateforme': 58, '02-installer': 190,
  '03-marchand': 110, '04-dispatch': 105, '05-livreur': 95, '06-compta': 75, '07-piloter': 152,
};

const vtt = (srt) => 'WEBVTT\n\n' + srt.replace(/\r/g, '').trim()
  .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2') + '\n';

fs.mkdirSync(CIBLE, { recursive: true });
for (const [id, t] of Object.entries(AFFICHES)) {
  const mp4 = path.join(SOURCE, `${id}.mp4`);
  if (!fs.existsSync(mp4)) { console.warn(`  ⚠ ${id}.mp4 absent de qa/demo/sortie`); continue; }
  fs.copyFileSync(mp4, path.join(CIBLE, `${id}.mp4`));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', '-q:v', '3',
    path.join(CIBLE, `${id}.jpg`)]);
  const srt = path.join(SOURCE, `${id}.srt`);
  if (fs.existsSync(srt)) fs.writeFileSync(path.join(CIBLE, `${id}.vtt`), vtt(fs.readFileSync(srt, 'utf-8')));
  console.log(`  ✓ ${id}`);
}
console.log(`Publié dans ${path.relative(RACINE, CIBLE)}/ — reconstruire l'image de la console pour le mettre en ligne.`);
