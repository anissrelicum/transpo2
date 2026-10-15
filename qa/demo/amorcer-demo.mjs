// Amorçage du tenant de la vidéo de démonstration — « Atlas Express », Casablanca.
//
// Remplit un tenant FRAÎCHEMENT provisionné avec une journée crédible : flotte, zones,
// comptes, ~30 commandes de trois marchands, menées dans leur cycle de vie réel par les
// bons acteurs (marchand → dispatcher → livreur). Uniquement par l'API HTTP publique :
// ni SQL, ni CLI `account`, ni kubectl — ce qui est filmé est exactement ce que l'API produit.
//
// Laisse volontairement pour le direct : 3 commandes COD assignées à Youssef Amrani
// (livrées depuis l'app), 6 commandes à dispatcher, des caisses à déclarer/déposer, et
// AUCUN reversement ni facture.
//
// Lancement :
//   TENANT=atlasexpress ADMIN_PASSWORD='…' node qa/demo/amorcer-demo.mjs
// Variables : API_URL, TENANT, ADMIN_EMAIL (défaut admin@<tenant>.ma), ADMIN_PASSWORD,
//             OUT (défaut qa/demo/sortie/comptes.json, relatif à la racine du dépôt).
//
// Les caisses COD sont datées du jour UTC de l'amorçage : amorcer le jour même du tournage.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { deflateSync } from 'node:zlib';

const API = (process.env.API_URL || 'http://transpo-api.wedowonders.com').replace(/\/$/, '');
const TENANT = process.env.TENANT;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || (TENANT ? `admin@${TENANT}.ma` : undefined);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const RACINE = path.resolve(import.meta.dirname, '../..');
const OUT = path.resolve(RACINE, process.env.OUT || 'qa/demo/sortie/comptes.json');

if (!TENANT || !ADMIN_PASSWORD) {
  console.error('Usage : TENANT=<slug> ADMIN_PASSWORD=<mot de passe admin> [ADMIN_EMAIL=…] [API_URL=…] node qa/demo/amorcer-demo.mjs');
  process.exit(2);
}

/* ============================== HTTP ============================== */

/** Appel d'API ; tout statut non 2xx arrête l'amorçage avec un message explicite. */
async function appel(chemin, { method = 'GET', body, jeton, tenant = TENANT, quoi } = {}) {
  let r;
  try {
    r = await fetch(`${API}${chemin}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(tenant ? { 'x-tenant-slug': tenant } : {}),
        ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`${quoi ?? chemin} : API injoignable (${API}) — ${e.cause?.code ?? e.message}`);
  }
  const texte = await r.text();
  let donnees = null;
  try { donnees = texte ? JSON.parse(texte) : null; } catch { donnees = texte; }
  if (!r.ok) {
    const motif = Array.isArray(donnees?.message) ? donnees.message.join(' ; ') : (donnees?.message ?? texte);
    throw new Error(`échec (${quoi ?? 'appel'}) — ${method} ${chemin} → HTTP ${r.status} : ${motif}`);
  }
  return donnees;
}

async function connexion(email, password) {
  const r = await appel('/v1/auth/login', { method: 'POST', body: { email, password }, quoi: `connexion ${email}` });
  if (!r?.token) throw new Error(`connexion ${email} : aucun jeton rendu`);
  return r.token;
}

/* ============================== Preuves ============================== */

// Photo de preuve : un carton kraft avec son ruban adhésif et son étiquette, en PNG
// généré ici même (pas de dépendance, pas de fichier binaire dans le dépôt).
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function bloc(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function photoColis(graine) {
  const L = 160, H = 120;
  const brut = Buffer.alloc((L * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    brut[y * (L * 3 + 1)] = 0;
    for (let x = 0; x < L; x++) {
      let rgb;
      const bord = x < 14 || x > L - 15 || y < 12 || y > H - 13;
      if (bord) rgb = [92 + (y % 7), 96, 104]; // sol du palier
      else if (Math.abs(x - L / 2) < 9) rgb = [214, 190, 140]; // ruban adhésif
      else if (x > 100 && x < 136 && y > 70 && y < 98) rgb = (y - 74) % 6 < 2 && x > 104 && x < 132 ? [40, 40, 40] : [246, 246, 240]; // étiquette
      else { const g = ((x * 7 + y * 3 + graine) % 11) - 5; rgb = [190 + g, 148 + g, 98 + g]; } // kraft
      brut.set(rgb, y * (L * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(L, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr), bloc('IDAT', deflateSync(brut)), bloc('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}
// Signature : un paraphe manuscrit en SVG, légèrement différent d'un client à l'autre.
function signature(graine) {
  const a = 18 + (graine % 9), b = 30 + (graine % 13);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100">`
    + `<path d="M12 70 C ${a} 20, ${b + 20} 20, 60 60 S 95 ${90 - a}, 110 45 S 150 ${b}, 165 62 `
    + `S 200 ${80 - (graine % 20)}, 215 40 S 255 65, 285 ${50 + (graine % 15)}" fill="none" stroke="#1b2a4a" stroke-width="3" stroke-linecap="round"/>`
    + `<path d="M40 82 L 250 78" stroke="#1b2a4a" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/* ============================== Décor ============================== */

const an = new Date().getUTCFullYear();
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

const SOCIETE = {
  legalName: 'Atlas Express SARL', ice: '002847193000056', rc: 'RC Casablanca 512 847',
  address: '27, rue Ibnou Mounir, Maârif, 20330 Casablanca',
  currency: 'MAD', timezone: 'Africa/Casablanca', defaultLang: 'fr',
};

const boite = (lat, lng, d = 0.03) => [[lat + d, lng - d], [lat + d, lng + d], [lat - d, lng + d], [lat - d, lng - d]];
const ZONES = [
  { nameFr: 'Casablanca Ouest', nameAr: 'الدار البيضاء الغربية', color: 'indigo', region: 'Casablanca-Settat', province: 'Casablanca', commune: 'Anfa', centre: [33.5890, -7.6320], drivers: ['Youssef Amrani', 'Karim Benjelloun'] },
  { nameFr: 'Casablanca Est', nameAr: 'الدار البيضاء الشرقية', color: 'cyan', region: 'Casablanca-Settat', province: 'Casablanca', commune: 'Aïn-Sebaâ', centre: [33.6000, -7.5400], drivers: ['Mehdi Tazi'] },
  { nameFr: 'Rabat Agdal', nameAr: 'الرباط أكدال', color: 'amber', region: 'Rabat-Salé-Kénitra', province: 'Rabat', commune: 'Agdal Riyad', centre: [33.9950, -6.8500], drivers: ['Imane Chraibi'] },
  { nameFr: 'Marrakech Guéliz', nameAr: 'مراكش جليز', color: 'grass', region: 'Marrakech-Safi', province: 'Marrakech', commune: 'Gueliz', centre: [31.6340, -8.0100], drivers: ['Samira El Fassi'] },
];

const VEHICULES = [
  { plate: '48213-A-6', type: 'Fourgon', city: 'Casablanca', capacity: '1,2 t · 8 m³', equipment: ['Diable', 'Sangles'], conducteur: 'Youssef Amrani' },
  { plate: '27654-B-6', type: 'Moto', city: 'Casablanca', capacity: '30 kg · top-case', equipment: ['Top-case'], conducteur: 'Karim Benjelloun' },
  { plate: '61542-H-1', type: 'Utilitaire', city: 'Rabat', capacity: '800 kg · 4 m³', equipment: ['Diable'], conducteur: 'Imane Chraibi' },
  { plate: '8834-D-33', type: 'Utilitaire', city: 'Marrakech', capacity: '800 kg · 4 m³', equipment: ['Sangles'], conducteur: 'Samira El Fassi' },
];

// Mehdi roule sur sa moto personnelle : il n'a pas de véhicule du parc rattaché.
const CHAUFFEURS = [
  { name: 'Youssef Amrani', city: 'Casablanca', vehicle: 'Fourgon', phone: '+212661482937', licenseNo: 'BK482915', email: `livreur@${TENANT}.ma`, gps: [33.5872, -7.6305] },
  { name: 'Karim Benjelloun', city: 'Casablanca', vehicle: 'Moto', phone: '+212662317845', licenseNo: 'BE215804', email: `karim.benjelloun@${TENANT}.ma`, gps: [33.5765, -7.6461] },
  { name: 'Imane Chraibi', city: 'Rabat', vehicle: 'Utilitaire', phone: '+212663904152', licenseNo: 'A1739260', email: `imane.chraibi@${TENANT}.ma`, gps: [33.9968, -6.8475] },
  { name: 'Mehdi Tazi', city: 'Casablanca', vehicle: 'Moto', phone: '+212664725318', licenseNo: 'BJ903147', email: `mehdi.tazi@${TENANT}.ma`, gps: [33.6031, -7.5362] },
  { name: 'Samira El Fassi', city: 'Marrakech', vehicle: 'Utilitaire', phone: '+212665180473', licenseNo: 'EE561028', email: `samira.elfassi@${TENANT}.ma`, gps: [31.6352, -8.0127] },
];

const MARCHANDS = {
  A: { nom: 'Maison Argane', email: `argane@${TENANT}.ma`, gerant: 'Leila Berrada', tel: '+212522251847', adresse: '14, rue Ahmed El Mokri, Maârif, Casablanca' },
  S: { nom: 'Souk Digital', email: `soukdigital@${TENANT}.ma`, gerant: 'Hamza Alami', tel: '+212522448190', adresse: 'Derb Ghallef, bd Bir Anzarane, Casablanca' },
  Z: { nom: 'Zellige & Co', email: `zellige@${TENANT}.ma`, gerant: 'Nawal Kettani', tel: '+212522367512', adresse: '52, bd Ghandi, Casablanca' },
};

// Une ligne par commande : marchand, destination, client, contenu, COD (0 = prépayée),
// et le scénario de la journée. `fin` = état visé ; `qui` = livreur.
const COMMANDES = [
  // — Livrées (12) —
  { m: 'A', ville: 'Casablanca', client: 'Khadija Ouazzani', tel: '+212661203948', adr: 'Résidence Al Firdaous, bd Abdelmoumen, Casablanca', desc: "Coffret huile d'argan bio 100 ml + savon noir", cod: 349, size: 'Petit', qui: 'Youssef Amrani', fin: 'LIVREE', note: [5, 'Livreur ponctuel et très aimable, merci !'] },
  { m: 'S', ville: 'Casablanca', client: 'Omar Bennis', tel: '+212662558104', adr: '23, rue Soumaya, quartier Palmier, Casablanca', desc: 'Smartphone Samsung Galaxy A55 128 Go', cod: 1150, size: 'Petit', proof: 'signature', qui: 'Youssef Amrani', fin: 'LIVREE' },
  { m: 'Z', ville: 'Casablanca', client: 'Sanaa Lahlou', tel: '+212663771520', adr: 'Villa 8, rue des Hirondelles, Californie, Casablanca', desc: 'Miroir cadre zellige 60 cm — fragile', cod: 0, size: 'Grand', notes: 'Fragile : verre et céramique, ne pas empiler.', qui: 'Youssef Amrani', fin: 'LIVREE' },
  { m: 'A', ville: 'Casablanca', client: 'Rachid Alaoui', tel: '+212664392017', adr: 'Bd Zerktouni, résidence Gauthier, 4e étage, Casablanca', desc: 'Crème visage à l’argan + eau de rose', cod: 260, size: 'Petit', qui: 'Karim Benjelloun', fin: 'LIVREE', note: [4, 'Rapide. Il a appelé avant de monter, parfait.'] },
  { m: 'S', ville: 'Casablanca', client: 'Nadia Sqalli', tel: '+212665017389', adr: 'Hay Hassani, rue 12 n° 8, Casablanca', desc: 'Écouteurs sans fil + chargeur rapide', cod: 720, size: 'Petit', qui: 'Karim Benjelloun', fin: 'LIVREE' },
  { m: 'A', ville: 'Casablanca', client: 'Hind Benkirane', tel: '+212666480152', adr: 'Ain Diab, rue de la Corniche, résidence Ocean View, Casablanca', desc: 'Lot ghassoul et gant kessa', cod: 0, size: 'Petit', qui: 'Karim Benjelloun', fin: 'LIVREE' },
  { m: 'Z', ville: 'Rabat', client: 'Youssef Berrada', tel: '+212667239845', adr: 'Agdal, avenue de France n° 41, Rabat', desc: 'Table basse plateau zellige — fragile', cod: 1080, size: 'Très grand', notes: 'Fragile. Livrer à deux de préférence.', qui: 'Imane Chraibi', fin: 'LIVREE', note: [5, 'Table arrivée intacte, livreuse très soigneuse.'] },
  { m: 'A', ville: 'Rabat', client: 'Salma Tazi', tel: '+212668104327', adr: 'Hay Riad, Mahaj Riad, immeuble 7, Rabat', desc: 'Huile d’argan cosmétique 50 ml ×2', cod: 199, size: 'Petit', qui: 'Imane Chraibi', fin: 'LIVREE' },
  { m: 'S', ville: 'Rabat', client: 'Anas El Idrissi', tel: '+212669572014', adr: 'Hassan, rue Patrice Lumumba n° 15, Rabat', desc: 'Montre connectée Huawei Watch Fit', cod: 640, size: 'Petit', qui: 'Imane Chraibi', fin: 'LIVREE', note: [4, 'Colis bien emballé, livraison rapide.'] },
  { m: 'A', ville: 'Casablanca', client: 'Meryem Chafik', tel: '+212670318254', adr: 'Sidi Maârouf, résidence Les Jardins, Casablanca', desc: 'Coffret hammam traditionnel', cod: 410, size: 'Moyen', qui: 'Mehdi Tazi', fin: 'LIVREE', note: [5, 'Top, livré en moins de deux heures.'] },
  { m: 'S', ville: 'Casablanca', client: 'Hamid Fassi Fihri', tel: '+212671049638', adr: 'Bourgogne, rue Ibn Battouta n° 22, Casablanca', desc: 'Disque SSD externe 1 To', cod: 0, size: 'Petit', qui: 'Mehdi Tazi', fin: 'LIVREE' },
  { m: 'Z', ville: 'Marrakech', client: 'Fatima Ait Lahcen', tel: '+212672663190', adr: 'Guéliz, rue de la Liberté n° 9, Marrakech', desc: 'Vase en céramique de Safi — fragile', cod: 560, size: 'Moyen', notes: 'Fragile.', qui: 'Samira El Fassi', fin: 'LIVREE', note: [3, 'Livré un peu tard, mais le vase est intact.'] },
  // — En cours (6) —
  { m: 'S', ville: 'Casablanca', client: 'Ilyas Mansouri', tel: '+212673205871', adr: 'Maârif, rue Al Fourat n° 30, Casablanca', desc: 'Tablette Lenovo Tab M10', cod: 980, size: 'Petit', qui: 'Karim Benjelloun', fin: 'LIVRAISON' },
  { m: 'A', ville: 'Casablanca', client: 'Zineb Kabbaj', tel: '+212674810326', adr: 'Oasis, rue des Orchidées n° 5, Casablanca', desc: 'Savon noir à l’eucalyptus ×3', cod: 315, size: 'Petit', qui: 'Karim Benjelloun', fin: 'RECUPEREE' },
  { m: 'Z', ville: 'Rabat', client: 'Driss Benslimane', tel: '+212675390418', adr: 'Souissi, avenue Mohammed VI, villa 112, Rabat', desc: 'Lanterne en laiton ciselé', cod: 750, size: 'Moyen', notes: 'Fragile.', qui: 'Imane Chraibi', fin: 'LIVRAISON' },
  { m: 'A', ville: 'Rabat', client: 'Loubna Rami', tel: '+212676027593', adr: 'Agdal, rue Oum Errabia n° 3, Rabat', desc: 'Coffret découverte argan & figue de barbarie', cod: 0, size: 'Petit', qui: 'Imane Chraibi', fin: 'RETRAIT' },
  { m: 'S', ville: 'Casablanca', client: 'Badr Ennaji', tel: '+212677418602', adr: 'Aïn Sebaâ, bd Moulay Slimane, résidence Nour, Casablanca', desc: 'Console PlayStation 5 Slim', cod: 1199, size: 'Moyen', proof: 'signature', qui: 'Mehdi Tazi', fin: 'RECUPEREE' },
  { m: 'A', ville: 'Marrakech', client: 'Amina Ouarzazi', tel: '+212678530914', adr: 'Hivernage, avenue Echouhada, Marrakech', desc: 'Huile de massage à l’argan 250 ml', cod: 280, size: 'Petit', qui: 'Samira El Fassi', fin: 'LIVRAISON' },
  // — Échecs (2) : l'un reste à traiter, l'autre est déjà rendu au marchand —
  { m: 'S', ville: 'Casablanca', client: 'Mounir Haddaoui', tel: '+212679641205', adr: 'Sidi Bernoussi, quartier Zenata, Casablanca', desc: 'Enceinte Bluetooth JBL Charge 5', cod: 1050, size: 'Moyen', qui: 'Mehdi Tazi', fin: 'ECHOUEE', motif: 'Client injoignable — téléphone éteint, trois tentatives.' },
  { m: 'Z', ville: 'Rabat', client: 'Karima Lamrani', tel: '+212680752316', adr: 'Hay Nahda, rue 21 n° 6, Rabat', desc: 'Lot de 4 carreaux zellige décoratifs', cod: 430, size: 'Moyen', qui: 'Imane Chraibi', fin: 'RETOUR', motif: 'Colis refusé par le client : coloris non conforme à la commande.' },
  // — Annulée (1) —
  { m: 'A', ville: 'Agadir', client: 'Hassan Ait Baha', tel: '+212681863427', adr: 'Talborjt, rue du 29 Février n° 17, Agadir', desc: 'Huile d’argan alimentaire 250 ml', cod: 230, size: 'Petit', fin: 'ANNULEE' },
  // — Assignées à Youssef, NON retirées : livrées en direct dans l'app (COD, Casablanca) —
  { m: 'A', ville: 'Casablanca', client: 'Ghita Benchekroun', tel: '+212682974538', adr: '18, rue Jean Jaurès, Gauthier, Casablanca', desc: 'Coffret soin cheveux argan & ricin', cod: 385, size: 'Petit', proof: 'signature', qui: 'Youssef Amrani', fin: 'ASSIGNEE' },
  { m: 'S', ville: 'Casablanca', client: 'Adil Chraibi', tel: '+212683085649', adr: 'Résidence Al Andalous, bd Ghandi, Casablanca', desc: 'Casque audio Sony WH-CH720N', cod: 1090, size: 'Petit', proof: 'signature', qui: 'Youssef Amrani', fin: 'ASSIGNEE' },
  { m: 'Z', ville: 'Casablanca', client: 'Houda Belkadi', tel: '+212684196750', adr: 'Californie, rue Nador n° 11, Casablanca', desc: 'Plateau de service en zellige', cod: 620, size: 'Moyen', notes: 'Fragile.', proof: 'signature', qui: 'Youssef Amrani', fin: 'ASSIGNEE' },
  // — À dispatcher (6) : 4 nouvelles + 2 programmées —
  { m: 'S', ville: 'Tanger', client: 'Soufiane Akhrif', tel: '+212685207861', adr: 'Malabata, résidence Marina Bay, Tanger', desc: 'Ordinateur portable HP 15 pouces', cod: 1150, size: 'Moyen', proof: 'signature', fin: 'NOUVELLE' },
  { m: 'A', ville: 'Fès', client: 'Nisrine Bennani', tel: '+212686318972', adr: 'Ville Nouvelle, avenue Hassan II n° 54, Fès', desc: 'Kit rituel beauté berbère', cod: 270, size: 'Petit', fin: 'NOUVELLE' },
  { m: 'Z', ville: 'Agadir', client: 'Abdellah Oubella', tel: '+212687420183', adr: 'Founty, résidence Sonaba, Agadir', desc: 'Fontaine murale en zellige — fragile', cod: 940, size: 'Grand', notes: 'Fragile : manipuler avec précaution.', fin: 'NOUVELLE' },
  { m: 'A', ville: 'Casablanca', client: 'Imad Squalli', tel: '+212688531294', adr: 'Racine, rue Ibnou Katir n° 7, Casablanca', desc: 'Coffret cadeau argan & rose de Kelâat M’Gouna', cod: 0, size: 'Petit', fin: 'NOUVELLE' },
  { m: 'S', ville: 'Marrakech', client: 'Yasmine Bouzidi', tel: '+212689642305', adr: 'Targa, résidence Menara Gardens, Marrakech', desc: 'Aspirateur robot Xiaomi', cod: 499, size: 'Grand', scheduled: true, notes: 'Livraison souhaitée samedi matin.', fin: 'PROGRAMMEE' },
  { m: 'Z', ville: 'Rabat', client: 'Reda Guessous', tel: '+212690753416', adr: 'Hay Riad, avenue Annakhil, villa 23, Rabat', desc: 'Table de jardin en fer forgé et zellige', cod: 1200, size: 'Très grand', scheduled: true, notes: 'Fragile. Créneau convenu : jeudi après-midi.', fin: 'PROGRAMMEE' },
];

const CHEMIN_TERRAIN = ['RETRAIT', 'RECUPEREE', 'LIVRAISON'];
const PROPRE = /^[A-Za-z0-9_]+$/; // frappable par `adb shell input text`

/* ============================== Amorçage ============================== */

async function amorcer() {
  console.log(`Amorçage de la démo « Atlas Express » — tenant ${TENANT} sur ${API}`);
  const admin = await connexion(ADMIN_EMAIL, ADMIN_PASSWORD);
  const A = (chemin, opts = {}) => appel(chemin, { ...opts, jeton: admin });

  // Garde-fou : le script raconte UNE journée, sur un tenant neuf. Rejoué sur un tenant
  // déjà peuplé, il doublerait les commandes et la caisse.
  const existantes = await A('/v1/orders', { quoi: 'lecture des commandes' });
  if (existantes.length) {
    throw new Error(`le tenant ${TENANT} contient déjà ${existantes.length} commande(s) — l'amorçage vise un tenant fraîchement provisionné.`);
  }

  // 1. Société.
  await A('/v1/settings/company', { method: 'POST', body: SOCIETE, quoi: 'paramètres société' });
  console.log(`  société : ${SOCIETE.legalName}, ICE ${SOCIETE.ice}`);

  // 2. Parc de véhicules (assurance et contrôle technique à jour).
  const parc = await A('/v1/vehicles');
  for (const v of VEHICULES) {
    if (parc.some((x) => x.plate === v.plate)) continue;
    const { conducteur: _c, ...corps } = v;
    parc.push(await A('/v1/vehicles', { method: 'POST', quoi: `véhicule ${v.plate}`, body: {
      ...corps, insuranceDue: `${an + 1}-03-31`, ctDue: `${an + 1}-06-30`,
    } }));
  }
  console.log(`  parc : ${VEHICULES.map((v) => `${v.plate} (${v.type})`).join(', ')}`);

  // 3. Chauffeurs, puis rattachement de leur véhicule.
  const effectif = await A('/v1/drivers');
  for (const c of CHAUFFEURS) {
    let fiche = effectif.find((d) => d.name === c.name);
    if (!fiche) {
      fiche = await A('/v1/drivers', { method: 'POST', quoi: `chauffeur ${c.name}`, body: {
        name: c.name, city: c.city, vehicle: c.vehicle, phone: c.phone, licenseNo: c.licenseNo,
        licenseDue: `${an + 4}-05-31`, medicalDue: `${an + 1}-11-30`, available: true,
      } });
    }
    const v = VEHICULES.find((x) => x.conducteur === c.name);
    if (v) {
      const vid = parc.find((x) => x.plate === v.plate).id;
      await A(`/v1/drivers/${fiche.id}/vehicle`, { method: 'PATCH', body: { vehicleId: vid }, quoi: `rattachement ${v.plate} → ${c.name}` });
    }
  }
  console.log(`  chauffeurs : ${CHAUFFEURS.map((c) => c.name).join(', ')}`);

  // 4. Zones de dispatch (un tenant neuf n'en a aucune) et leurs livreurs.
  const zones = await A('/v1/dispatch/zones');
  for (const z of ZONES) {
    const { centre, drivers, ...corps } = z;
    let zone = zones.find((x) => x.nameFr === z.nameFr);
    if (!zone) {
      zone = await A('/v1/dispatch/zones', { method: 'POST', quoi: `zone ${z.nameFr}`, body: {
        ...corps, centerLat: centre[0], centerLng: centre[1], polygon: boite(...centre),
      } });
    }
    await A(`/v1/dispatch/zones/${zone.id}`, { method: 'PATCH', body: { drivers }, quoi: `livreurs de la zone ${z.nameFr}` });
  }
  console.log(`  zones : ${ZONES.map((z) => z.nameFr).join(', ')}`);

  // 5. Comptes. Le mot de passe temporaire est rendu par l'API ; un compte livreur est
  //    réinitialisé jusqu'à obtenir un secret frappable au clavier de l'émulateur.
  const utilisateurs = await A('/v1/users');
  const nomAdmin = utilisateurs.find((u) => u.email === ADMIN_EMAIL.toLowerCase())?.name ?? 'Administrateur';
  const comptes = [{ email: ADMIN_EMAIL, role: 'ADMIN', name: nomAdmin, password: ADMIN_PASSWORD }];
  async function compte({ email, name, role, merchant, driver }) {
    const deja = utilisateurs.find((u) => u.email === email);
    let id, password;
    if (deja) {
      id = deja.id;
      ({ tempPassword: password } = await A(`/v1/users/${id}/reset-password`, { method: 'POST', quoi: `réinitialisation ${email}` }));
    } else {
      const r = await A('/v1/users', { method: 'POST', quoi: `invitation ${email}`, body: { email, name, role, merchant, driver } });
      id = r.id; password = r.tempPassword;
    }
    for (let essai = 0; role === 'DRIVER' && !PROPRE.test(password ?? ''); essai++) {
      if (essai >= 30) throw new Error(`compte ${email} : aucun mot de passe frappable après 30 réinitialisations`);
      ({ tempPassword: password } = await A(`/v1/users/${id}/reset-password`, { method: 'POST', quoi: `réinitialisation ${email}` }));
    }
    if (!password) throw new Error(`compte ${email} : aucun mot de passe temporaire rendu`);
    comptes.push({ email, role, name, password, ...(merchant ? { merchant } : {}), ...(driver ? { driver } : {}) });
    return password;
  }
  await compte({ email: `dispatch@${TENANT}.ma`, name: 'Salma Idrissi', role: 'DISPATCHER' });
  await compte({ email: `compta@${TENANT}.ma`, name: 'Fatima Zahra Bennani', role: 'COMPTABLE' });
  for (const c of CHAUFFEURS) await compte({ email: c.email, name: c.name, role: 'DRIVER', driver: c.name });
  for (const m of Object.values(MARCHANDS)) await compte({ email: m.email, name: m.gerant, role: 'MERCHANT', merchant: m.nom });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ tenant: TENANT, api: API, emisLe: new Date().toISOString(), comptes }, null, 2)}\n`);
  console.log(`  comptes : ${comptes.length} (mots de passe dans ${OUT.startsWith(RACINE) ? path.relative(RACINE, OUT) : OUT})`);

  // Jetons des acteurs de la journée.
  const mdp = (email) => comptes.find((c) => c.email === email).password;
  const dispatch = await connexion(`dispatch@${TENANT}.ma`, mdp(`dispatch@${TENANT}.ma`));
  const compta = await connexion(`compta@${TENANT}.ma`, mdp(`compta@${TENANT}.ma`));
  const livreurs = {};
  for (const c of CHAUFFEURS) livreurs[c.name] = await connexion(c.email, mdp(c.email));
  const marchands = {};
  for (const [k, m] of Object.entries(MARCHANDS)) marchands[k] = await connexion(m.email, mdp(m.email));
  const D = (chemin, opts = {}) => appel(chemin, { ...opts, jeton: dispatch });
  const L = (nom) => (chemin, opts = {}) => appel(chemin, { ...opts, jeton: livreurs[nom] });

  // 6. Les marchands déposent leurs commandes depuis leur portail.
  const creees = [];
  for (const [i, c] of COMMANDES.entries()) {
    const m = MARCHANDS[c.m];
    const o = await appel('/v1/orders', { method: 'POST', jeton: marchands[c.m], quoi: `commande ${i + 1} (${m.nom})`, body: {
      fromCity: 'Casablanca', toCity: c.ville, cod: c.cod, size: c.size,
      proofLevel: c.proof ?? 'photo_signature', scheduled: !!c.scheduled,
      pickupContact: m.gerant, pickupPhone: m.tel, pickupAddress: m.adresse,
      dropContact: c.client, dropPhone: c.tel, dropAddress: c.adr, dropNotes: c.notes,
      description: c.desc,
    } });
    creees.push({ ...c, ref: o.ref, code: o.code, proofLevel: o.proofLevel });
  }
  console.log(`  commandes déposées : ${creees.length}`);

  // 7. La journée : le dispatcher affecte, le livreur avance depuis son app, livre avec
  //    preuve et encaisse le COD, ou déclare l'échec.
  let n = 0;
  for (const c of creees) {
    if (c.fin === 'NOUVELLE' || c.fin === 'PROGRAMMEE') continue;
    if (c.fin === 'ANNULEE') {
      await D(`/v1/orders/${c.ref}/cancel`, { method: 'POST', quoi: `annulation ${c.ref}` });
      continue;
    }
    await D(`/v1/orders/${c.ref}/assign`, { method: 'POST', body: { driver: c.qui }, quoi: `affectation ${c.ref} → ${c.qui}` });
    if (c.fin === 'ASSIGNEE') continue;
    const terrain = L(c.qui);
    const cible = ['LIVREE', 'ECHOUEE', 'RETOUR'].includes(c.fin) ? 'LIVRAISON' : c.fin;
    for (const etape of CHEMIN_TERRAIN.slice(0, CHEMIN_TERRAIN.indexOf(cible) + 1)) {
      const o = await terrain(`/v1/driver/orders/${c.ref}/advance`, { method: 'POST', quoi: `${c.qui} : ${c.ref} → ${etape}` });
      if (o.status !== etape) throw new Error(`${c.ref} : statut ${o.status} au lieu de ${etape}`);
    }
    if (c.fin === 'LIVREE') {
      const graine = ++n * 37;
      const exige = c.proofLevel;
      await terrain(`/v1/driver/orders/${c.ref}/proof`, { method: 'POST', quoi: `preuve ${c.ref}`, body: {
        codCollected: c.cod,
        photo: exige === 'photo' || exige === 'photo_signature' ? photoColis(graine) : undefined,
        signature: exige === 'signature' || exige === 'photo_signature' ? signature(graine) : undefined,
      } });
    } else if (c.fin === 'ECHOUEE' || c.fin === 'RETOUR') {
      await terrain(`/v1/driver/orders/${c.ref}/fail`, { method: 'POST', body: { reason: c.motif }, quoi: `échec ${c.ref}` });
      if (c.fin === 'RETOUR') {
        await D(`/v1/returns/${c.ref}/return-to-merchant`, { method: 'POST', quoi: `retour marchand ${c.ref}` });
      }
    }
  }
  console.log('  journée jouée : affectations, retraits, livraisons avec preuve, échecs');

  // 8. Tournée du jour de Youssef : ses trois courses à livrer en direct.
  const directes = creees.filter((c) => c.fin === 'ASSIGNEE');
  await D('/v1/tournees', { method: 'POST', quoi: 'tournée de Youssef Amrani', body: {
    driver: 'Youssef Amrani', zone: 'Casablanca Ouest', day: AUJOURDHUI, stops: directes.map((c) => c.ref),
  } });

  // 9. Positions GPS : chaque livreur pousse les siennes, la carte live n'est pas vide.
  for (const c of CHAUFFEURS) {
    for (let k = 0; k < 3; k++) {
      await L(c.name)('/v1/tracking/position', { method: 'POST', quoi: `position ${c.name}`, body: {
        lat: c.gps[0] - 0.004 + k * 0.002, lng: c.gps[1] + 0.003 - k * 0.0015,
      } });
    }
  }

  // 10. Caisse : Imane a déclaré puis déposé ; Mehdi a déclaré, son dépôt se fait en
  //     direct ; Karim déclare 60 DH de moins que l'attendu (l'écart que la compta résout,
  //     motif à l'appui, au chapitre 6) ; Youssef et Samira ont encore leur caisse en cours.
  for (const [nom, depot, manque] of [['Imane Chraibi', true, 0], ['Mehdi Tazi', false, 0], ['Karim Benjelloun', false, 60]]) {
    const caisse = await L(nom)('/v1/driver/cash', { quoi: `caisse ${nom}` });
    if (!caisse) throw new Error(`caisse ${nom} : aucune session ouverte aujourd'hui`);
    await L(nom)('/v1/driver/cash/declare', { method: 'POST', body: { amount: caisse.theorique - manque }, quoi: `déclaration ${nom}` });
    if (depot) await appel(`/v1/cash/sessions/${caisse.id}/deposit`, { method: 'POST', jeton: compta, quoi: `dépôt ${nom}` });
  }

  // 11. Avis clients, laissés depuis la page de suivi publique.
  for (const c of creees.filter((x) => x.note)) {
    await appel(`/v1/public/track/${TENANT}/${c.code}/rate`, { method: 'POST', tenant: null, quoi: `avis ${c.code}`,
      body: { score: c.note[0], comment: c.note[1] } });
  }

  // 12. Bilan, relu depuis l'API.
  const finales = await A('/v1/orders');
  const parStatut = finales.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {});
  const sessions = await appel('/v1/cash/sessions', { jeton: compta });
  const encaisse = finales.filter((o) => o.status === 'LIVREE' && o.codPaid).reduce((s, o) => s + o.cod, 0);
  console.log('\nÉtat final');
  console.log(`  commandes : ${finales.length} — ${Object.entries(parStatut).map(([s, k]) => `${s} ${k}`).join(' · ')}`);
  console.log(`  COD encaissé : ${encaisse} DH`);
  console.log(`  caisses : ${sessions.map((s) => `${s.driver} ${s.status} (${s.theorique} DH)`).join(' · ')}`);
  console.log(`  à livrer en direct par Youssef Amrani : ${directes.map((c) => `${c.ref} (${c.cod} DH, ${c.client})`).join(', ')}`);
  console.log('\nComptes');
  for (const c of comptes) console.log(`  ${c.role.padEnd(10)} ${c.email.padEnd(34)} ${c.password}  ${c.name}`);
}

amorcer().then(
  () => console.log('\nDécor de la démo en place.'),
  (e) => { console.error(`\nAmorçage interrompu — ${e.message}`); process.exit(1); },
);
