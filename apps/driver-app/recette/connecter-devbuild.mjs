// Connecte l'app de DÉVELOPPEMENT (et non Expo Go) et accorde les autorisations.
import { saisir, toucher, attendre, clavierFerme, sleep, ecran, chercher, visible } from './lib.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const ADB = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf-8' });
const PAQUET = 'com.anissrelicum.transpodriver';
const journal = (m) => fs.appendFileSync(process.env.SONDE, m + '\n');

try {
  adb('shell', 'am', 'force-stop', PAQUET);
  await sleep(1500);
  adb('shell', 'monkey', '-p', PAQUET, '-c', 'android.intent.category.LAUNCHER', '1');
  await sleep(12000);

  await attendre('login-organisation', { timeout: 60_000, message: "l'écran de connexion ne s'affiche pas" });
  await saisir('login-organisation', 'demoexpress');
  await saisir('login-email', 'livreur@demoexpress.ma');
  await saisir('login-mot-de-passe', 'Demo1234');
  await clavierFerme();
  await toucher('login-valider');
  await sleep(5000);
  journal('connexion envoyée');

  // Écran des autorisations : on accorde les trois, dont les notifications — c'est ce
  // dernier appui qui déclenche la vraie demande système via OneSignal.
  for (let i = 0; i < 6; i += 1) {
    if (await visible('Commencer ma journée')) break;
    const n = (await ecran()).find((x) => x.texte === 'Autoriser' && x.centre);
    if (!n) break;
    await toucher(n.texte);
    await sleep(2000);
    for (const sys of ['While using the app', 'Allow', 'Autoriser']) {
      if (await visible(sys)) { await toucher(sys); await sleep(1500); break; }
    }
  }
  if (await visible('Commencer ma journée')) {
    await toucher('Commencer ma journée');
    await sleep(4000);
  }
  const e = await ecran();
  journal('écran courant → ' + (chercher(e, 'Mes missions') ? 'Mes missions' : (e.find((x) => x.texte)?.texte ?? '?')));
} catch (err) {
  journal('ERREUR=' + err.message);
}
