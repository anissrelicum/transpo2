// Range les vidéos Playwright dans qa/recette/<run>/TC-XXX/.
// Playwright écrit <outputDir>/<fichier>-<titre>-<projet>/video.webm ; on en extrait
// l'identifiant de cas (TC-A01…) pour classer la preuve à côté du verdict.
import fs from 'node:fs';
import path from 'node:path';

const RUN = process.env.RUN_ID || '2026-09-12-homelab';
const BASE = path.resolve(import.meta.dirname, '../../../qa/recette', RUN);
const VIDEOS = path.join(BASE, 'videos');

if (!fs.existsSync(VIDEOS)) {
  console.log(`rien à ranger (${VIDEOS} absent)`);
  process.exit(0);
}

let range = 0;
for (const dir of fs.readdirSync(VIDEOS)) {
  const src = path.join(VIDEOS, dir);
  if (!fs.statSync(src).isDirectory()) continue;
  const webm = fs.readdirSync(src).find((f) => f.endsWith('.webm'));
  if (!webm) continue;

  const tc = dir.match(/TC-[A-Z]\d{2}/)?.[0];
  if (!tc) { console.warn(`⚠ cas non identifié : ${dir}`); continue; }

  const dest = path.join(BASE, tc);
  fs.mkdirSync(dest, { recursive: true });
  // retest-a03 → TC-A03/retest.webm ; sinon TC-A03/TC-A03.webm
  const suffixe = dir.startsWith('retest') ? 'retest' : tc;
  let cible = path.join(dest, `${suffixe}.webm`);
  for (let n = 2; fs.existsSync(cible); n++) cible = path.join(dest, `${suffixe}-${n}.webm`);

  fs.renameSync(path.join(src, webm), cible);
  // On conserve trace.zip / captures d'échec éventuelles à côté de la vidéo.
  for (const reste of fs.readdirSync(src)) {
    fs.renameSync(path.join(src, reste), path.join(dest, reste));
  }
  fs.rmdirSync(src);
  range++;
  console.log(`${tc} ← ${path.basename(cible)}`);
}
console.log(`\n${range} vidéo(s) rangée(s) dans ${BASE}`);
