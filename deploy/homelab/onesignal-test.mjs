// Envoie une notification d'essai à un livreur, par son identifiant externe.
//
//   ONESIGNAL_API_KEY=<clé REST DE L'APPLICATION> node deploy/homelab/onesignal-test.mjs 'demoexpress:Hamid Ouali'
//
// ATTENTION : la clé d'ORGANISATION (`os_v2_org_…`) est refusée ici. Elle sert à gérer les
// applications, pas à envoyer. L'envoi réclame la clé REST de l'application (`os_v2_app_…`),
// visible dans le tableau de bord sous Settings → Keys & IDs.
//
// Sert à vérifier la chaîne complète SANS passer par une affectation de course : si ceci
// arrive sur le téléphone, le reste (clé FCM, build, enregistrement de l'appareil) est bon.
const APP_ID = process.env.ONESIGNAL_APP_ID || 'e5247c1a-99fb-4557-a226-5ae3ce81160f';
const CLE = process.env.ONESIGNAL_API_KEY;
const CIBLE = process.argv[2];

if (!CLE || !CIBLE) {
  console.error("usage : ONESIGNAL_API_KEY=<clé REST de l'app> node onesignal-test.mjs '<tenant>:<chauffeur>'");
  process.exit(2);
}

const r = await fetch('https://api.onesignal.com/notifications', {
  method: 'POST',
  headers: { authorization: `Key ${CLE}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    app_id: APP_ID,
    target_channel: 'push',
    include_aliases: { external_id: [CIBLE] },
    headings: { en: 'Transpo', fr: 'Transpo' },
    contents: { en: 'Essai : nouvelle mission CMD-DEMO — Rabat.', fr: 'Essai : nouvelle mission CMD-DEMO — Rabat.' },
  }),
});
const d = await r.json().catch(() => null);

if (!r.ok) {
  console.error(`refusé (${r.status}) :`, d);
  if (r.status === 401 && (CLE.startsWith('os_v2_org_'))) {
    console.error('\n→ cette clé est une clé d’ORGANISATION. L’envoi réclame la clé REST de');
    console.error('  l’APPLICATION (os_v2_app_…), dans le tableau de bord : Settings → Keys & IDs.');
  }
  process.exit(1);
}
// `recipients: 0` n'est pas une réussite : c'est « personne n'écoute sous cet identifiant ».
// Le dire franchement évite de chercher la panne du mauvais côté.
if (d?.recipients === 0) {
  console.error('aucun appareil enregistré sous « ' + CIBLE + ' ».');
  console.error('→ l’app doit avoir été ouverte, connectée, et la permission accordée.');
  process.exit(1);
}
console.log(`envoyée à ${d?.recipients ?? '?'} appareil(s) · identifiant ${d?.id}`);
