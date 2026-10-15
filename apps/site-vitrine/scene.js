// Interactions du site vitrine — vanille, sans dépendance, chargé en `defer`.
//
//   1. le formulaire de démonstration, envoyé au serveur (relais `/api/demande`) ;
//   2. la fenêtre de la vidéo de présentation ;
//   3. les onglets des écrans du produit ;
//   4. le menu sur mobile et l'ombre de l'en-tête au défilement ;
//   5. une apparition douce des blocs au défilement, coupée si la personne a demandé
//      moins d'animation.
//
// Rien n'est masqué sans JavaScript : la page est entièrement lisible à l'arrêt.
// Les textes affichés existent en français et en anglais, selon `<html lang>`.

(() => {
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)');
  const anglais = (document.documentElement.lang || '').toLowerCase().startsWith('en');

  const TEXTES = anglais
    ? {
        envoi: 'Sending…',
        echec: 'Sending failed. Please try again in a moment, or write to us directly — we also answer by phone.',
        succes: 'Request received. We will get back to you within two business days with a time slot, '
          + 'and replay a typical day on your own numbers.',
        succesCourt: 'Request received. We will get back to you within two business days.',
        nonPrecisee: 'Not specified',
        aPreciser: 'To be specified',
      }
    : {
        envoi: 'Envoi…',
        echec: 'L’envoi a échoué. Réessayez dans un instant, ou écrivez-nous directement — '
          + 'nous répondons aussi par téléphone.',
        succes: 'Demande enregistrée. Nous revenons vers vous sous deux jours ouvrés avec un créneau, '
          + 'et nous rejouerons une journée type sur vos propres chiffres.',
        succesCourt: 'Demande enregistrée. Nous revenons vers vous sous deux jours ouvrés.',
        nonPrecisee: 'Non précisée',
        aPreciser: 'À préciser',
      };

  /* ------------------------------------------------------------ demandes ---
   *
   * La demande est ENVOYÉE AU SERVEUR, qui l'enregistre. Elle ouvrait auparavant la
   * messagerie du visiteur : sur un téléphone en webmail elle ne s'ouvre souvent pas, et
   * la demande se perdait sans que personne le sache. Le relais est de même origine
   * (`/api/demande`, relayé par nginx), l'API n'est pas exposée au navigateur.
   * Champs envoyés : societe, nom, email, telephone, villes, livreurs, message, source.
   */
  const envoyer = async (donnees, bouton, note, succes) => {
    const libelle = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = TEXTES.envoi;
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
      note.textContent = TEXTES.echec;
      note.dataset.etat = 'erreur';
      return false;
    } finally {
      bouton.disabled = false;
      bouton.textContent = libelle;
    }
  };

  // Formulaire court (adresse seule), conservé si une page en remet un.
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
    // et l'échange se poursuit par courriel.
    const domaine = email.value.split('@')[1] ?? '';
    const ok = await envoyer({
      societe: domaine || TEXTES.nonPrecisee,
      nom: TEXTES.aPreciser,
      email: email.value,
      source: 'accroche',
    }, bouton, note, TEXTES.succesCourt);
    if (ok) rampe.reset();
  });

  const contact = document.getElementById('form-contact');
  contact?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(contact);
    const v = (k) => String(d.get(k) ?? '').trim();
    if (!v('societe') || !v('nom') || !v('email') || !contact.checkValidity()) {
      contact.reportValidity();
      return;
    }
    const bouton = contact.querySelector('button[type="submit"]');
    const note = document.getElementById('form-note');
    const ok = await envoyer({
      societe: v('societe'), nom: v('nom'), email: v('email'),
      telephone: v('telephone'), villes: v('villes'),
      livreurs: v('livreurs'), message: v('message'), source: 'contact',
    }, bouton, note, TEXTES.succes);
    if (ok) contact.reset();
  });

  /* -------------------------------------------------------------- vidéo ---
   * Le bouton du héros pointe vers la section vidéo : sans JavaScript (ou sans
   * <dialog>), le lien y mène simplement. Avec, il ouvre la vidéo en grand.
   */
  const fenetre = document.getElementById('fenetre-video');
  if (fenetre && typeof fenetre.showModal === 'function') {
    const video = fenetre.querySelector('video');
    let declencheur = null;
    for (const lien of document.querySelectorAll('[data-video-ouvrir]')) {
      lien.addEventListener('click', (ev) => {
        ev.preventDefault();
        declencheur = lien;
        // Une seule vidéo joue à la fois.
        for (const autre of document.querySelectorAll('video')) if (autre !== video) autre.pause();
        fenetre.showModal();
        video?.play().catch(() => {});
      });
    }
    fenetre.querySelector('[data-video-fermer]')?.addEventListener('click', () => fenetre.close());
    // Un clic sur le fond (hors de la vidéo) ferme la fenêtre.
    fenetre.addEventListener('click', (ev) => { if (ev.target === fenetre) fenetre.close(); });
    fenetre.addEventListener('close', () => {
      video?.pause();
      declencheur?.focus();
    });
  }

  /* ------------------------------------------------------------ onglets ---
   * Motif ARIA « tabs » : flèches gauche/droite, Début/Fin, activation automatique.
   */
  const liste = document.querySelector('[data-onglets]');
  const panneaux = document.querySelector('[data-panneaux]');
  if (liste && panneaux) {
    const onglets = [...liste.querySelectorAll('[role="tab"]')];
    const activer = (cible, focus) => {
      for (const o of onglets) {
        const actif = o === cible;
        o.setAttribute('aria-selected', String(actif));
        o.tabIndex = actif ? 0 : -1;
        const p = document.getElementById(o.getAttribute('aria-controls'));
        if (p) p.hidden = !actif;
      }
      if (focus) cible.focus();
    };
    liste.classList.add('est-actif');
    panneaux.classList.add('est-actif');
    for (const p of panneaux.querySelectorAll('[role="tabpanel"]')) p.tabIndex = 0;
    activer(onglets[0], false);
    liste.addEventListener('click', (ev) => {
      const o = ev.target.closest('[role="tab"]');
      if (o) activer(o, false);
    });
    liste.addEventListener('keydown', (ev) => {
      const i = onglets.indexOf(document.activeElement);
      if (i < 0) return;
      const n = onglets.length;
      const cle = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[ev.key];
      if (cle === undefined) return;
      ev.preventDefault();
      activer(onglets[(cle + n) % n], true);
    });
  }

  /* --------------------------------------------------------------- menu --- */
  const menu = document.querySelector('[data-menu]');
  const nav = document.getElementById('nav-principale');
  if (menu && nav) {
    const fermer = () => { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('est-ouvert'); };
    menu.addEventListener('click', () => {
      const ouvert = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!ouvert));
      nav.classList.toggle('est-ouvert', !ouvert);
    });
    nav.addEventListener('click', (ev) => { if (ev.target.closest('a')) fermer(); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && nav.classList.contains('est-ouvert')) { fermer(); menu.focus(); }
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', fermer);
  }

  /* ------------------------------------------------------------ en-tête --- */
  const entete = document.querySelector('[data-entete]');
  if (entete) {
    const suivre = () => entete.classList.toggle('est-defile', window.scrollY > 8);
    window.addEventListener('scroll', suivre, { passive: true });
    suivre();
  }

  /* --------------------------------------------------------- apparition ---
   * Seuls les blocs encore SOUS la ligne de flottaison sont masqués puis révélés : ce
   * qui est déjà à l'écran au chargement ne clignote jamais.
   */
  if (calme.matches || !('IntersectionObserver' in window)) return;
  const blocs = [...document.querySelectorAll('[data-revele]')];
  const hauteur = window.innerHeight;
  const observateur = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('est-visible');
      observateur.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  // Toutes les lectures de mise en page d'abord, toutes les écritures ensuite : alterner
  // les deux forcerait un recalcul de la page à chaque bloc.
  const aReveler = blocs.filter((bloc) => bloc.getBoundingClientRect().top >= hauteur);
  for (const bloc of aReveler) {
    // Léger décalage entre voisins d'une même grille.
    const voisins = bloc.parentElement ? [...bloc.parentElement.children].filter((c) => c.hasAttribute('data-revele')) : [];
    const rang = voisins.length > 1 ? voisins.indexOf(bloc) % 4 : 0;
    if (rang) bloc.style.transitionDelay = `${rang * 70}ms`;
    bloc.classList.add('revele');
    observateur.observe(bloc);
  }
})();
