// Contenu de la page « Démos » de la console SaaS : la démo produit narrée, chapitre par
// chapitre. Les vidéos sont produites par qa/demo/ (voir qa/demo/README.md) puis publiées dans
// apps/console-web/demos/ par `node qa/demo/publier.mjs` ; elles ne sont pas versionnées.
//
// Les instants du déroulé (`t`, en secondes) correspondent aux sous-titres de chaque vidéo :
// cliquer une étape place la lecture à cet endroit.

export interface EtapeDemo {
  t: number;
  titre: string;
  texte: string;
}

export interface ChapitreDemo {
  id: string;            // ancre de la page et nom des fichiers publiés (<id>.mp4, .vtt, .jpg)
  numero: number;
  titre: string;
  accroche: string;
  acteur: string;        // qui est à l'écran
  surface: string;       // quelle partie du produit
  duree: number;         // secondes
  resume: string;
  deroule: EtapeDemo[];
  aRetenir: string[];
}

export const FIL_ROUGE = {
  societe: 'Atlas Express',
  ville: 'Casablanca',
  devise: 'Une course, quatre mains, un seul dossier.',
};

export const VIDEO_COMPLETE = { id: 'transpo-demo-complete', duree: 1489 };

export const CHAPITRES: ChapitreDemo[] = [
  {
    id: '00-decouvrir',
    numero: 0,
    titre: 'Découvrir Transpo',
    accroche: 'Le site vitrine, jusqu’à la demande de démonstration.',
    acteur: 'Un prospect : Karim Berrada, Atlas Express',
    surface: 'Site vitrine',
    duree: 135,
    resume:
      'On présente la promesse du produit et le fil rouge de toute la démo : Atlas Express, transporteur fictif basé à Casablanca. Le visiteur parcourt le principe « quatre mains » (marchand, dispatch, livreur, comptabilité), estime le prix d’une course, puis envoie une demande de démonstration qui arrivera dans la console de la plateforme.',
    deroule: [
      { t: 0, titre: 'Introduction', texte: 'Transpo, logiciel d’exploitation des transporteurs au Maroc, et le fil rouge Atlas Express.' },
      { t: 20, titre: 'La promesse', texte: 'Dispatch, exécution hors réseau, preuve de livraison, suivi de chaque dirham jusqu’au reversement.' },
      { t: 47, titre: 'Quatre mains, un dossier', texte: 'Le marchand dépose, le dispatch affecte, le livreur exécute, la comptabilité rapproche.' },
      { t: 71, titre: 'Bureau et terrain', texte: 'La console d’exploitation d’un côté, l’application livreur de l’autre.' },
      { t: 89, titre: 'Estimation de prix', texte: 'Douze kilomètres, colis fragile : la grille par défaut et sa majoration.' },
      { t: 108, titre: 'Demande de démo', texte: 'Atlas Express remplit le formulaire : contact, villes, flotte, besoin. La demande part vers la plateforme.' },
    ],
    aRetenir: [
      'La demande envoyée depuis le site arrive directement dans l’onglet Demandes de la console SaaS.',
      'Le simulateur public applique la même grille que celle livrée à chaque transporteur.',
    ],
  },
  {
    id: '01-plateforme',
    numero: 1,
    titre: 'La plateforme',
    accroche: 'Recevoir une demande, ouvrir un transporteur, suivre son abonnement.',
    acteur: 'L’équipe Transpo (super-administrateur)',
    surface: 'Console SaaS',
    duree: 125,
    resume:
      'Dans la console réservée à l’équipe Transpo, on retrouve la demande d’Atlas Express, on la qualifie, puis on provisionne l’organisation : espace de données dédié et premier administrateur créés en une opération. On termine par le suivi de la consommation face au quota du plan et par le journal d’audit.',
    deroule: [
      { t: 0, titre: 'Connexion plateforme', texte: 'Un espace de connexion séparé : un compte plateforme n’appartient à aucune organisation.' },
      { t: 19, titre: 'Organisations', texte: 'Plans, abonnements, revenu mensuel ; les impayés et suspensions sont signalés d’eux-mêmes.' },
      { t: 32, titre: 'La demande d’Atlas Express', texte: 'Contact, villes, flotte, besoin ; note de suivi et passage au statut « contactée ».' },
      { t: 50, titre: 'Provisionnement', texte: 'Identifiant, nom commercial, ville, plan, puis le premier administrateur : Karim Berrada.' },
      { t: 74, titre: 'Mot de passe unique', texte: 'Le mot de passe temporaire n’est affiché qu’une fois ; Atlas Express démarre en essai de 14 jours.' },
      { t: 96, titre: 'Facturation et audit', texte: 'Consommation réelle face au quota, montant mensuel, et trace de chaque action sensible.' },
    ],
    aRetenir: [
      'Provisionner crée le schéma de données isolé du transporteur et son administrateur en une seule opération.',
      'À la fin de l’essai sans souscription, l’organisation passe en impayé puis est suspendue automatiquement.',
      'Le provisionnement figure dans le journal d’audit, avec son auteur et son heure.',
    ],
  },
  {
    id: '02-installer',
    numero: 2,
    titre: 'Installer l’exploitation',
    accroche: 'Société, équipe, flotte, zones et tarifs : tout ce qu’il faut avant la première course.',
    acteur: 'Karim Berrada, administrateur d’Atlas Express',
    surface: 'Console transport — Administration',
    duree: 218,
    resume:
      'L’administrateur prépare son espace : identité légale et réglages régionaux, rôles de l’équipe et invitation d’un dispatcher, ajout d’un chauffeur et d’un véhicule avec leurs échéances de conformité, zones bilingues rattachées au découpage officiel, et grille tarifaire avec son simulateur.',
    deroule: [
      { t: 10, titre: 'Connexion à l’organisation', texte: 'Des identifiants qui ne valent que pour Atlas Express.' },
      { t: 30, titre: 'Paramètres', texte: 'ICE et registre du commerce sur chaque facture ; dirham, fuseau de Casablanca ; commission et TVA.' },
      { t: 63, titre: 'Équipe et rôles', texte: 'Droits vérifiés par le serveur ; invitation d’Omar Lahlou, mot de passe affiché une seule fois.' },
      { t: 103, titre: 'Chauffeurs', texte: 'Nabil Ouazzani : permis et visite médicale décident s’il peut recevoir des courses.' },
      { t: 132, titre: 'Véhicules', texte: 'Une moto immatriculée, avec assurance et contrôle technique sous alerte.' },
      { t: 148, titre: 'Zones', texte: 'Noms en français et en arabe, région, province, commune ; livreurs affectés.' },
      { t: 174, titre: 'Tarification', texte: 'Grille par paliers, suppléments, simulateur, cascade prix fixe → remise → grille standard.' },
    ],
    aRetenir: [
      'Un chauffeur dont le permis ou la visite médicale expire est écarté automatiquement des suggestions du dispatch.',
      'La cascade tarifaire est stricte : prix fixe négocié, sinon grille remisée, sinon grille standard.',
      'Commission et TVA pilotent toute la chaîne : facture du marchand, reversement et devis.',
    ],
  },
  {
    id: '03-marchand',
    numero: 3,
    titre: 'Le marchand dépose',
    accroche: 'Une livraison créée en une minute, localisée par un simple lien.',
    acteur: 'Leila Berrada, gérante de Maison Argane (marchand)',
    surface: 'Portail marchand',
    duree: 199,
    resume:
      'Maison Argane confie ses livraisons à Atlas Express. Sa gérante consulte son tableau de bord, puis crée une livraison sans taper d’adresse : elle colle le lien Google Maps de sa boutique, puis le message WhatsApp où la cliente a partagé sa position. Les épingles se placent, les adresses se remplissent, le lien est conservé pour le livreur, et le prix se calcule sur la vraie distance. La commande apparaît avec son code de suivi ; le portefeuille montre l’argent encaissé pour elle.',
    deroule: [
      { t: 11, titre: 'Tableau de bord marchand', texte: 'Commandes, livrées, en route, COD à encaisser et taux de réussite du transporteur.' },
      { t: 52, titre: 'Retrait par lien', texte: 'Le lien Google Maps de la boutique est collé : épingle placée, adresse retrouvée.' },
      { t: 75, titre: 'Livraison par WhatsApp', texte: 'Le message de la cliente est collé tel quel ; le lien est reconnu et conservé pour le livreur.' },
      { t: 96, titre: 'Distance réelle', texte: 'Ville reconnue d’elle-même ; le prix suit la distance entre les deux épingles.' },
      { t: 108, titre: 'Colis et preuve', texte: 'Format, contenu, niveau de preuve exigé, 420 DH à encaisser.' },
      { t: 145, titre: 'Commande créée', texte: 'Statut « Nouvelle », référence et code de suivi pour la cliente.' },
      { t: 166, titre: 'Portefeuille', texte: 'COD encaissé, commission retenue et net à reverser, commande par commande.' },
    ],
    aRetenir: [
      'Un lien Google Maps, Waze, Apple Plans ou un message WhatsApp suffit : plus d’adresse à recopier.',
      'Le lien d’origine est transmis au livreur, qui l’ouvre pour naviguer jusqu’à la porte.',
      'Cette commande est celle que le dispatch affecte au chapitre 4 et que Youssef livre au chapitre 5.',
    ],
  },
  {
    id: '04-dispatch',
    numero: 4,
    titre: 'Le dispatch affecte',
    accroche: 'Choisir le bon livreur, organiser la tournée, traiter les imprévus.',
    acteur: 'Salma Idrissi, dispatcher',
    surface: 'Console transport — Opérations',
    duree: 233,
    resume:
      'La dispatcher filtre les commandes et ouvre un dossier livré (cycle de vie, preuve, historique, facturation). Sur la carte du dispatch, elle affecte la commande de Maison Argane à l’aide des suggestions notées sur cent points, valide la tournée de Youssef, suit la flotte en temps réel et reprogramme une livraison échouée.',
    deroule: [
      { t: 8, titre: 'Commandes et filtres', texte: 'Livraisons terminées de Maison Argane en deux clics.' },
      { t: 41, titre: 'Dossier d’une commande', texte: 'Cycle de vie, preuve horodatée, journal des faits, détail du contre-remboursement.' },
      { t: 84, titre: 'Dispatch sur carte', texte: 'Livreurs en ligne et commandes à affecter, dont celle de Leila.' },
      { t: 99, titre: 'Affectation assistée', texte: 'Score sur 100 : zone, disponibilité, charge ; la recommandation reste un conseil.' },
      { t: 147, titre: 'Tournée', texte: 'Arrêts ordonnés, COD à collecter, optimisation de l’ordre, validation.' },
      { t: 170, titre: 'PC flotte', texte: 'Positions en temps réel, suivi d’un livreur, géofences.' },
      { t: 196, titre: 'Retours', texte: 'Motif, tentatives, COD bloqué ; reprogrammation d’une tentative.' },
    ],
    aRetenir: [
      'Un livreur indisponible ou non conforme n’est jamais proposé : impossible de l’affecter par erreur.',
      'L’historique d’une commande est la référence en cas de litige : chaque statut, son auteur, son heure.',
      'Après trois échecs, seul le retour au marchand reste possible.',
    ],
  },
  {
    id: '05-livreur',
    numero: 5,
    titre: 'Le livreur exécute',
    accroche: 'Retrait, preuve, encaissement, caisse : chaque geste est horodaté.',
    acteur: 'Youssef Amrani, livreur',
    surface: 'Application livreur (Android)',
    duree: 169,
    resume:
      'Sur son téléphone, Youssef se connecte, accorde les autorisations et retrouve ses missions affectées par le dispatch. Il livre la commande de Maison Argane : progression confirmée étape par étape, signature du destinataire, encaissement de 420 DH avec calcul de la monnaie. Il enchaîne une seconde livraison puis déclare sa caisse du jour, au dirham près.',
    deroule: [
      { t: 10, titre: 'Connexion', texte: 'Identifiant de la société et accès personnels ; application en français et en arabe.' },
      { t: 29, titre: 'Autorisations', texte: 'Localisation, appareil photo et notifications, chacune expliquée.' },
      { t: 45, titre: 'Mes missions', texte: 'Marchand, destination, montant à encaisser, niveau de preuve.' },
      { t: 58, titre: 'Progression', texte: 'Chaque étape confirmée et horodatée ; hors réseau, l’action attend le retour de la connexion.' },
      { t: 88, titre: 'Preuve et encaissement', texte: 'Signature à l’écran, montant reçu, monnaie à rendre, livraison clôturée.' },
      { t: 116, titre: 'Mission suivante', texte: 'Le même geste, sans avoir à deviner ce que l’application attend.' },
      { t: 137, titre: 'Caisse du jour', texte: 'Montant attendu sur la journée, déclaration de ce qui est en main : compte juste.' },
    ],
    aRetenir: [
      'Tant que la preuve exigée n’est pas complète, la validation reste fermée.',
      'Le montant encaissé part directement dans la caisse du livreur, visible aussitôt par la comptabilité.',
      'Dans cette démo, la preuve se fait par signature ; la preuve par photo fonctionne sur le même écran.',
    ],
  },
  {
    id: '06-compta',
    numero: 6,
    titre: 'La compta rapproche',
    accroche: 'Du cash encaissé sur le terrain jusqu’au reversement des marchands.',
    acteur: 'Fatima Zahra Bennani, comptable — puis Leila Berrada côté marchand',
    surface: 'Console transport — Facturation, puis portail marchand',
    duree: 219,
    resume:
      'La comptable rapproche, pour chaque livreur, le COD théorique, le cash déclaré et l’écart. Elle enregistre le dépôt de Youssef, résout l’écart de Karim Benjelloun avec un motif, exporte le rapprochement, génère et verse les reversements, puis génère les factures de la période. Côté marchand, Leila retrouve ces montants dans son portefeuille et sa facture.',
    deroule: [
      { t: 10, titre: 'Rôle comptable', texte: 'Caisse, reversements et facturation ouverts à son rôle.' },
      { t: 24, titre: 'Réconciliation cash', texte: 'En circulation, à déposer, écarts, déposé ; théorique, déclaré et écart par livreur.' },
      { t: 47, titre: 'Dépôt de Youssef', texte: 'Déclaration exacte, dépôt en agence, session clôturée.' },
      { t: 69, titre: 'Écart motivé', texte: 'Clôture bloquée tant que l’écart n’est pas expliqué ; motif et note tracés.' },
      { t: 100, titre: 'Export comptable', texte: 'Tout le rapprochement en un fichier, sans tableur parallèle.' },
      { t: 108, titre: 'Reversements', texte: 'Un par marchand pour la période ; virement à Maison Argane avec sa référence.' },
      { t: 147, titre: 'Factures', texte: 'Livraisons, commission de 15 %, net hors taxes, TVA de 20 % ; export.' },
      { t: 174, titre: 'Vue du marchand', texte: 'Portefeuille et facture de Leila, calculés à partir des mêmes livraisons.' },
    ],
    aRetenir: [
      'Un écart de caisse ne s’efface jamais : il est motivé, tracé, et alimente le suivi de fraude.',
      'Le reversement conserve sa méthode et sa référence bancaire pour tout contrôle.',
      'Marchand et transporteur lisent les mêmes montants, commande par commande.',
    ],
  },
  {
    id: '07-piloter',
    numero: 7,
    titre: 'Piloter et protéger',
    accroche: 'Mesurer la qualité, détecter les écarts, respecter le client.',
    acteur: 'Karim Berrada, administrateur',
    surface: 'Console transport — Pilotage',
    duree: 191,
    resume:
      'L’administrateur prend de la hauteur : tableau de bord du jour, analytics et respect du SLA par ville, livreur et marchand, détection de fraude COD avec score et arbitrage humain, avis clients, centre de notifications et consentement (loi 09-08), modèles bilingues. La console bascule en arabe, de droite à gauche, puis en thème sombre.',
    deroule: [
      { t: 7, titre: 'Tableau de bord', texte: 'Commandes en cours, livrées, en échec, à affecter ; COD du jour.' },
      { t: 28, titre: 'Analytics et SLA', texte: 'Taux de réussite, répartition par statut, motifs d’échec, SLA par ville, livreur, marchand.' },
      { t: 58, titre: 'Fraude COD', texte: 'Signaux objectifs, score par cas, aucune sanction automatique.' },
      { t: 88, titre: 'Avis clients', texte: 'Note moyenne, livreurs à surveiller, commentaires reliés aux commandes.' },
      { t: 104, titre: 'Notifications', texte: 'Chaque SMS et push tracé ; consentement par canal (loi 09-08) ; modèles FR / AR.' },
      { t: 145, titre: 'Arabe et thème sombre', texte: 'Toute la console bascule de droite à gauche, puis en thème sombre.' },
      { t: 171, titre: 'Conclusion', texte: 'Le marchand dépose, le dispatch affecte, le livreur prouve, la comptabilité rapproche.' },
    ],
    aRetenir: [
      'La fraude est signalée, jamais sanctionnée automatiquement : chaque décision est humaine et tracée.',
      'Un message marketing sans consentement préalable est bloqué ; les messages transactionnels partent toujours.',
      'La console entière est bilingue, mise en page comprise.',
    ],
  },
];

/** Fichiers servis par /api/demos/<nom> : liste fermée, rien d'autre n'est lisible. */
export const FICHIERS_DEMOS: string[] = [VIDEO_COMPLETE.id, ...CHAPITRES.map((c) => c.id)]
  .flatMap((id) => [`${id}.mp4`, `${id}.vtt`, `${id}.jpg`]);

export function horodatage(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
