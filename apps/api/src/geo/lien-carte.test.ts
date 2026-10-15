// Lecture des liens de localisation — un test par format rencontré sur le terrain.
// Lancement : pnpm --filter @transpo/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserLien, coordonneesDansPage, hoteAutorise, requeteTextuelle } from './lien-carte.ts';

const CASA = { lat: 33.5731, lng: -7.5898 };

function lu(texte: string, attendu: { lat: number; lng: number }, precision?: string, source?: string) {
  const r = analyserLien(texte);
  assert.ok(r, `aucune position lue dans : ${texte}`);
  assert.equal(r.lat, attendu.lat, `lat — ${texte}`);
  assert.equal(r.lng, attendu.lng, `lng — ${texte}`);
  if (precision) assert.equal(r.precision, precision, `précision — ${texte}`);
  if (source) assert.equal(r.source, source, `source — ${texte}`);
}

/* ---------------- Coordonnées brutes ---------------- */
test('brut : « 33.5731, -7.5898 » et variantes', () => {
  lu('33.5731, -7.5898', CASA, 'exacte', 'coordonnees');
  lu('33.5731,-7.5898', CASA);
  lu('  33.5731 -7.5898 ', CASA);
  lu('33.5731;-7.5898', CASA);
  lu('geo:33.5731,-7.5898', CASA);
  lu('geo:33.5731,-7.5898?z=17', CASA);
});

test('brut : degrés-minutes-secondes (copie Google)', () => {
  const r = analyserLien(`33°34'23.2"N 7°35'23.3"W`);
  assert.ok(r);
  assert.ok(Math.abs(r.lat - 33.573111) < 1e-5 && Math.abs(r.lng - -7.589806) < 1e-5);
});

test('brut : position en clair dans un message', () => {
  lu('Je suis ici 33.5731, -7.5898 merci', CASA);
});

/* ---------------- Google Maps ---------------- */
test('Google : lieu `!3d!4d` préféré au cadrage `@`', () => {
  lu(
    'https://www.google.com/maps/place/Twin+Center/@33.5880,-7.6330,17z/data=!3m1!4b1!4m6!3m5!1s0xda7d2f0d1e1bfa3:0x6e8e9fd1d5c3d7b0!8m2!3d33.5856!4d-7.6339!16s%2Fm%2F02r2cdp',
    { lat: 33.5856, lng: -7.6339 }, 'exacte', 'google',
  );
});

test('Google : `maps.google.com/?q=lat,lng`', () => {
  lu('https://maps.google.com/?q=33.5731,-7.5898', CASA, 'point', 'google');
  lu('https://maps.google.com/maps?q=loc:33.5731,-7.5898', CASA, 'point');
  lu('https://maps.google.com/?q=33.5731,-7.5898+(Boutique)', CASA, 'point');
  lu('https://www.google.co.ma/maps?q=33.5731%2C-7.5898', CASA, 'point');
});

test('Google : `/maps/search/lat,+lng` et `?api=1&query=`', () => {
  lu('https://www.google.com/maps/search/33.5731,+-7.5898?entry=tts', CASA, 'point');
  lu('https://www.google.com/maps/search/?api=1&query=33.5731,-7.5898', CASA, 'point');
});

test('Google : `/maps/place/lat,lng` sans `!3d`', () => {
  lu('https://www.google.com/maps/place/33.5731,-7.5898/@33.5731,-7.5898,17z', CASA, 'point');
});

test('Google : `/maps/place/` en degrés-minutes-secondes', () => {
  const r = analyserLien("https://www.google.com/maps/place/33%C2%B034'23.2%22N+7%C2%B035'23.3%22W/@33.57,-7.58,17z");
  assert.ok(r);
  assert.equal(r.precision, 'point');
  assert.ok(Math.abs(r.lat - 33.573111) < 1e-5 && Math.abs(r.lng - -7.589806) < 1e-5);
});

test('Google : itinéraire `/maps/dir/` → la DESTINATION', () => {
  lu('https://www.google.com/maps/dir/33.5000,-7.6000/33.5731,-7.5898/@33.55,-7.59,14z', CASA, 'point');
});

test('Google : `?ll=` et cadrage seul `@lat,lng,15z`', () => {
  lu('https://www.google.com/maps?ll=33.5731,-7.5898&z=16', CASA, 'point');
  lu('https://www.google.com/maps/@33.5731,-7.5898,15z', CASA, 'vue');
});

test('Google : `?q=` textuel puis `ll=` → le point `ll`', () => {
  lu('https://maps.google.com/maps?q=Twin+Center&ll=33.5731,-7.5898', CASA, 'point');
});

test('Google : lien court seul → illisible sans réseau', () => {
  assert.equal(analyserLien('https://maps.app.goo.gl/AbCdEf123456'), null);
  assert.equal(analyserLien('https://goo.gl/maps/AbCdEf123'), null);
});

test('Google : page de consentement → la suite `continue`', () => {
  lu(
    'https://consent.google.com/ml?continue=https://www.google.com/maps/place/X/data%3D!3d33.5731!4d-7.5898&gl=FR',
    CASA, 'exacte',
  );
});

/* ---------------- Apple Plans ---------------- */
test('Plans : `?ll=`, `?q=lat,lng`, `coordinate=`', () => {
  lu('https://maps.apple.com/?ll=33.5731,-7.5898&q=Ma%20position', CASA, 'point', 'apple');
  lu('https://maps.apple.com/?q=33.5731,-7.5898', CASA, 'point', 'apple');
  lu('https://maps.apple.com/place?coordinate=33.5731,-7.5898&name=Maison', CASA, 'point', 'apple');
});

test('Plans : `?address=` → pas de position, mais une requête géocodable', () => {
  const t = 'https://maps.apple.com/?address=Boulevard%20Zerktouni,%20Casablanca';
  assert.equal(analyserLien(t), null);
  assert.equal(requeteTextuelle(new URL(t)), 'Boulevard Zerktouni, Casablanca');
});

/* ---------------- Waze ---------------- */
test('Waze : `waze.com/ul?ll=`, `ul.waze.com`, `to=ll.`', () => {
  lu('https://waze.com/ul?ll=33.5731%2C-7.5898&navigate=yes', CASA, 'point', 'waze');
  lu('https://ul.waze.com/ul?ll=33.5731,-7.5898&navigate=yes&zoom=17', CASA, 'point', 'waze');
  lu('https://www.waze.com/live-map/directions?to=ll.33.5731%2C-7.5898', CASA, 'point', 'waze');
});

/* ---------------- OpenStreetMap ---------------- */
test('OSM : `?mlat=&mlon=` (marqueur) préféré à `#map=`', () => {
  lu('https://www.openstreetmap.org/?mlat=33.5731&mlon=-7.5898#map=17/33.5000/-7.5000', CASA, 'point', 'osm');
});

test('OSM : `#map=z/lat/lng` (cadrage)', () => {
  lu('https://www.openstreetmap.org/#map=17/33.5731/-7.5898', CASA, 'vue', 'osm');
});

/* ---------------- WhatsApp ---------------- */
test('WhatsApp : lien noyé dans un message', () => {
  lu('📍 Ma position : https://maps.google.com/?q=33.5731,-7.5898 — merci !', CASA, 'point', 'google');
});

/* ---------------- Refus ---------------- */
test('invalide : texte, nombres isolés, bornes, (0,0)', () => {
  for (const t of [
    '', 'bonjour', '33.5731', '12 rue Ibn Batouta', 'https://maps.google.com/?q=95.0,-7.5',
    'https://maps.google.com/?q=33.5,-190.2', '0.0, 0.0', 'javascript:alert(1)',
    'https://www.google.com/maps/place/Twin+Center',
  ]) {
    assert.equal(analyserLien(t), null, `ne devait rien lire : « ${t} »`);
  }
});

/* ---------------- Liste blanche (anti-SSRF) ---------------- */
test('liste blanche : services de carte acceptés', () => {
  for (const u of [
    'https://maps.app.goo.gl/AbC', 'https://goo.gl/maps/AbC', 'https://g.co/kgs/AbC',
    'https://www.google.com/maps/place/x', 'https://google.co.ma/maps', 'https://maps.google.fr/?q=x',
    'https://maps.apple.com/?q=x', 'https://waze.com/ul?ll=1,1', 'https://ul.waze.com/ul',
    'https://www.openstreetmap.org/', 'https://osm.org/go/xyz', 'http://maps.google.com/?q=x',
  ]) assert.equal(hoteAutorise(new URL(u)), true, u);
});

test('liste blanche : tout le reste refusé', () => {
  for (const u of [
    'http://169.254.169.254/latest/meta-data/', 'http://localhost:3000/v1/orders', 'http://10.0.0.5/',
    'https://google.com.evil.io/maps', 'https://evil.com/maps.app.goo.gl', 'https://maps.app.goo.gl.evil.io/x',
    'https://goo.gl/AbC', 'https://www.google.com/search?q=x', 'https://bit.ly/abc',
    'https://maps.app.goo.gl:8443/x', 'https://user:pw@maps.app.goo.gl/x', 'ftp://maps.google.com/',
    'https://drive.google.com/maps/x', 'file:///etc/passwd',
  ]) assert.equal(hoteAutorise(new URL(u)), false, u);
});

/* ---------------- Contenu de page ---------------- */
test('page : cadrage par défaut de Google (vignette `center=`, état initial) IGNORÉ', () => {
  // Constaté sur une vraie page « /maps/place/Mosquée+Hassan+II » : ces deux valeurs
  // portaient le cadrage déduit de l'IP du serveur (Bouskoura), pas le lieu.
  const html = '<meta content="https://maps.google.com/maps/api/staticmap?center=33.46638525%2C-7.68670275&amp;zoom=10" property="og:image">'
    + 'window.APP_INITIALIZATION_STATE=[[[53253.5,-7.68670275,33.46638525]';
  assert.equal(coordonneesDansPage(html), null);
});

test('page : métadonnées Plans `place:location:*`', () => {
  const html = '<meta property="place:location:latitude" content="33.5731"><meta property="place:location:longitude" content="-7.5898">';
  const r = coordonneesDansPage(html);
  assert.ok(r);
  assert.deepEqual([r.lat, r.lng], [33.5731, -7.5898]);
});

test('page : `!3d!4d` prioritaire sur le reste', () => {
  const r = coordonneesDansPage('"latitude": 1.5, "longitude": 1.5 … data=!3d33.5731!4d-7.5898');
  assert.ok(r);
  assert.deepEqual([r.lat, r.lng, r.precision], [33.5731, -7.5898, 'exacte']);
});

test('page : rien → null', () => {
  assert.equal(coordonneesDansPage('<html><body>Not found</body></html>'), null);
});
