// Lanceur : `node recette/run.mjs g01 g02 …` (sans argument : tous les cas de la section G).
//
// Les cas mobiles d'autres sections (TC-I05, par exemple) portent leur propre préfixe et
// se lancent nommément : la section G reste le déroulé par défaut.
import * as fs from 'node:fs';
import * as path from 'node:path';

const dossier = import.meta.dirname;
const demandes = process.argv.slice(2);
const fichiers = (demandes.length ? demandes : fs.readdirSync(dossier)
  .filter((f) => /^g\d+\.mjs$/.test(f)).map((f) => f.replace('.mjs', '')).sort());
for (const nom of fichiers) {
  if (!fs.existsSync(path.join(dossier, `${nom}.mjs`))) {
    console.error(`Cas inconnu : ${nom}`);
    process.exit(2);
  }
}

let echecs = 0;
for (const nom of fichiers) {
  const mod = await import(path.join(dossier, `${nom}.mjs`));
  try {
    await mod.default();
  } catch (e) {
    echecs++;
    console.error(`${nom} : ÉCHEC — ${e.message}`);
  }
}
console.log(`\n${fichiers.length - echecs}/${fichiers.length} cas passés`);
process.exit(echecs ? 1 : 0);
