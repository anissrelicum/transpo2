// Interactions du site vitrine — vanille, sans dépendance.
//
//   1. l'estimateur de prix, qui applique la VRAIE grille par défaut du produit ;
//   2. les deux formulaires, qui composent un message dans la messagerie du visiteur ;
//   3. un léger relief sur les copies d'écran, coupé si la personne a demandé moins
//      d'animation.
//
// Rien n'est masqué au chargement : la page est entièrement lisible à l'arrêt.

(() => {
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --------------------------------------------------------- estimation ---
   * La grille est celle de `packages/domain/src/index.ts` (`PRICE_TIERS`,
   * `FRAGILE_SURCHARGE`, `SCHEDULED_SURCHARGE`). Elle est recopiée ici parce qu'un site
   * statique ne peut pas importer le paquet — et c'est la seule duplication du site, donc
   * la seule chose à reprendre si la grille d'amorçage change un jour.
   */
  const PALIERS = [
    { jusqua: 3, base: 22 },
    { jusqua: 7, base: 32 },
    { jusqua: 15, base: 48 },
    { jusqua: 30, base: 75 },
    { jusqua: Infinity, parKm: 3.2 },
  ];
  const MAJORATION_FRAGILE = 15;
  const MAJORATION_PROGRAMMEE = 10;

  // « 48,00 DH » et non « 48,00 MAD » : c'est ainsi que le produit écrit les montants,
  // partout, et le site ne doit pas parler une autre langue que les écrans qu'il montre.
  const nombre = new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dirhams = { format: (v) => `${nombre.format(v)} DH` };

  const prixDeLaCourse = (km, fragile, programmee) => {
    const d = Number.isFinite(km) && km > 0 ? km : 0;
    const palier = PALIERS.find((p) => d <= p.jusqua) ?? PALIERS[PALIERS.length - 1];
    const base = palier.parKm ? Math.round(palier.parKm * d) : palier.base;
    return base + (fragile ? MAJORATION_FRAGILE : 0) + (programmee ? MAJORATION_PROGRAMMEE : 0);
  };

  const distance = document.getElementById('c-distance');
  const fragile = document.getElementById('c-fragile');
  const programmee = document.getElementById('c-programmee');
  const total = document.getElementById('c-total');

  if (distance && total) {
    const recalculer = () => {
      total.textContent = dirhams.format(
        prixDeLaCourse(parseFloat(distance.value), fragile?.checked, programmee?.checked),
      );
    };
    for (const champ of [distance, fragile, programmee]) {
      champ?.addEventListener('input', recalculer);
      champ?.addEventListener('change', recalculer);
    }
    document.getElementById('form-calcul')?.addEventListener('submit', (e) => e.preventDefault());
    recalculer();
  }

  /* ------------------------------------------------------------ demandes ---
   *
   * La demande est ENVOYÉE AU SERVEUR, qui l'enregistre. Elle ouvrait auparavant la
   * messagerie du visiteur : sur un téléphone en webmail elle ne s'ouvre souvent pas, et
   * la demande se perdait sans que personne le sache. Le relais est de même origine
   * (`/api/demande`), l'API n'est pas exposée au navigateur.
   */
  const envoyer = async (donnees, bouton, note, succes) => {
    const libelle = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = 'Envoi…';
    try {
      const r = await fetch('/api/demande', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(donnees),
      });
      if (!r.ok) throw new Error(String(r.status));
      note.textContent = succes;
      note.dataset.etat = 'ok';
      return true;
    } catch {
      // On ne prétend pas avoir reçu ce qu'on n'a pas reçu.
      note.textContent = 'L’envoi a échoué. Réessayez dans un instant, ou écrivez-nous '
        + 'directement — nous répondons aussi par téléphone.';
      note.dataset.etat = 'erreur';
      return false;
    } finally {
      bouton.disabled = false;
      bouton.textContent = libelle;
    }
  };

  const rampe = document.getElementById('form-rampe');
  rampe?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = document.getElementById('r-email');
    const note = document.getElementById('rampe-note');
    const bouton = rampe.querySelector('button[type="submit"]');
    if (!(email instanceof HTMLInputElement) || !email.checkValidity()) {
      email?.reportValidity();
      return;
    }
    // Depuis l'accroche on n'a que l'adresse : société et nom sont déduits du domaine,
    // et l'échange se poursuit par courriel. Mieux vaut une demande incomplète qu'un
    // formulaire de huit champs qui fait fuir.
    const domaine = email.value.split('@')[1] ?? '';
    const ok = await envoyer({
      societe: domaine || 'Non précisée',
      nom: 'À préciser',
      email: email.value,
      source: 'accroche',
    }, bouton, note, 'Demande enregistrée. Nous revenons vers vous sous deux jours ouvrés.');
    if (ok) rampe.reset();
  });

  const contact = document.getElementById('form-contact');
  contact?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(contact);
    const v = (k) => String(d.get(k) ?? '').trim();
    if (!v('societe') || !v('nom') || !v('email')) {
      contact.reportValidity();
      return;
    }
    const bouton = contact.querySelector('button[type="submit"]');
    const note = document.getElementById('form-note');
    const ok = await envoyer({
      societe: v('societe'), nom: v('nom'), email: v('email'),
      telephone: v('telephone'), villes: v('villes'),
      livreurs: v('livreurs'), message: v('message'), source: 'contact',
    }, bouton, note, 'Demande enregistrée. Nous revenons vers vous sous deux jours ouvrés '
       + 'avec un créneau, et nous rejouerons une journée type sur vos propres chiffres.');
    if (ok) contact.reset();
  });

  /* ---------------------------------------------------------- le relief ---- */
  if (calme.matches) return;

  const borne = (valeur, debut, taille) => {
    if (!taille) return 0;
    return Math.max(-1, Math.min(1, ((valeur - debut) / taille) * 2 - 1));
  };

  for (const capture of document.querySelectorAll('[data-tilt-doux]')) {
    let image = null;
    capture.addEventListener('pointermove', (ev) => {
      const r = capture.getBoundingClientRect();
      const x = borne(ev.clientX, r.left, r.width);
      const y = borne(ev.clientY, r.top, r.height);
      if (image) return;
      image = requestAnimationFrame(() => {
        image = null;
        // Faible : au-delà, le texte de la copie d'écran devient illisible — et c'est
        // précisément ce qu'on veut donner à lire.
        capture.style.setProperty('--try', `${x * 3.5}deg`);
        capture.style.setProperty('--trx', `${-y * 2.5}deg`);
      });
    }, { passive: true });
    const reposer = () => {
      capture.style.setProperty('--try', '0deg');
      capture.style.setProperty('--trx', '0deg');
    };
    capture.addEventListener('pointerleave', reposer, { passive: true });
  }
})();
