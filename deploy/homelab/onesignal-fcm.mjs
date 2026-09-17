// Dépose les justificatifs d'envoi push dans OneSignal, par leur API.
//
// OneSignal peut RECEVOIR ces justificatifs, il ne peut pas les créer : le fichier de
// compte de service Firebase se génère dans la console Google, et la clé APNs dans le
// compte Apple Developer. Ce script ne fait que le dernier pas.
//
//   ONESIGNAL_API_KEY=<clé organisation> node deploy/homelab/onesignal-fcm.mjs ./firebase-service-account.json
//   ONESIGNAL_API_KEY=<clé organisation> node deploy/homelab/onesignal-fcm.mjs --verifier
//
// La clé n'est PAS écrite ici : elle vient de l'environnement, comme partout ailleurs.
import fs from 'node:fs';

const APP_ID = process.env.ONESIGNAL_APP_ID || 'e5247c1a-99fb-4557-a226-5ae3ce81160f';
const CLE = process.env.ONESIGNAL_API_KEY;
if (!CLE) {
  console.error('ONESIGNAL_API_KEY manquante (clé ORGANISATION, pas la clé REST de l’app).');
  process.exit(2);
}

const entetes = { authorization: `Key ${CLE}`, 'content-type': 'application/json' };

async function etat() {
  const r = await fetch(`https://api.onesignal.com/apps/${APP_ID}`, { headers: entetes });
  const a = await r.json();
  if (!r.ok) throw new Error(`lecture refusée (${r.status}) : ${JSON.stringify(a)}`);
  return {
    nom: a.name,
    android: a.fcm_v1_service_account_json ? 'configuré' : 'NON configuré',
    ios: a.apns_env || 'NON configuré',
    abonnes: a.players ?? 0,
  };
}

const chemin = process.argv[2];

if (!chemin || chemin === '--verifier') {
  console.log(await etat());
  process.exit(0);
}

const brut = fs.readFileSync(chemin, 'utf-8');
let compte;
try {
  compte = JSON.parse(brut);
} catch {
  console.error(`${chemin} n’est pas un JSON valide.`);
  process.exit(2);
}
// Un fichier de compte de service porte ces trois champs. Les vérifier évite d'envoyer
// à OneSignal un `google-services.json` (fichier CLIENT) à la place — la confusion est
// fréquente, et OneSignal l'accepterait sans rien pouvoir en faire.
for (const champ of ['type', 'project_id', 'private_key']) {
  if (!compte[champ]) {
    console.error(`${chemin} ne ressemble pas à un compte de service Firebase (champ « ${champ} » absent).`);
    console.error('Attendu : Firebase → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée.');
    process.exit(2);
  }
}
if (compte.type !== 'service_account') {
  console.error(`type attendu « service_account », lu « ${compte.type} ».`);
  process.exit(2);
}

console.log(`projet Firebase : ${compte.project_id}`);
console.log('avant :', await etat());

const r = await fetch(`https://api.onesignal.com/apps/${APP_ID}`, {
  method: 'PUT',
  headers: entetes,
  body: JSON.stringify({
    // Le champ attend le fichier encodé en base64, pas le JSON brut.
    fcm_v1_service_account_json: Buffer.from(brut, 'utf-8').toString('base64'),
  }),
});
const reponse = await r.json().catch(() => null);
if (!r.ok) {
  console.error(`dépôt refusé (${r.status}) :`, reponse);
  process.exit(1);
}
console.log('après  :', await etat());
console.log('\nAndroid est prêt. Il reste à produire une build de développement de l’app livreur :');
console.log('  cd apps/driver-app && npx expo prebuild && npx expo run:android');
