// Interactions 3D du site vitrine — vanille, sans dépendance.
//
// Deux effets seulement, et ils obéissent tous deux à `prefers-reduced-motion` :
//   1. le téléphone et ses cartes flottantes suivent le pointeur (parallaxe légère) ;
//   2. les trois scènes s'inclinent sous le pointeur qui les survole.
//
// Rien n'est masqué au chargement : la page est entièrement lisible à l'arrêt, et la 3D
// ne fait que la mettre en relief. Un visiteur sans JavaScript voit exactement le même
// contenu, simplement sans le relief.

(() => {
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (calme.matches) return;

  /** Ramène une valeur dans [-1, 1] à partir d'une position dans un rectangle. */
  const centre = (valeur, debut, taille) => {
    if (!taille) return 0;
    return Math.max(-1, Math.min(1, ((valeur - debut) / taille) * 2 - 1));
  };

  // ---------------------------------------------------------- le téléphone
  const scene = document.querySelector('[data-scene]');
  const phone = document.querySelector('[data-phone]');
  const flottants = Array.from(document.querySelectorAll('[data-flotte]'));

  if (scene && phone) {
    let image = null;

    const suivre = (ev) => {
      const r = scene.getBoundingClientRect();
      const x = centre(ev.clientX, r.left, r.width);
      const y = centre(ev.clientY, r.top, r.height);
      if (image) return;
      image = requestAnimationFrame(() => {
        image = null;
        phone.style.setProperty('--ry', `${x * 9}deg`);
        phone.style.setProperty('--rx', `${-y * 7}deg`);
        for (const f of flottants) {
          const profondeur = Number(f.dataset.flotte) || 1;
          f.style.setProperty('--fx', `${x * 10 * profondeur}px`);
          f.style.setProperty('--fy', `${y * 8 * profondeur}px`);
        }
      });
    };

    const relacher = () => {
      phone.style.setProperty('--ry', '0deg');
      phone.style.setProperty('--rx', '0deg');
      for (const f of flottants) {
        f.style.setProperty('--fx', '0px');
        f.style.setProperty('--fy', '0px');
      }
    };

    // Le pointeur est écouté sur la fenêtre : la scène déborde largement de sa boîte,
    // et n'écouter que celle-ci rendait l'effet saccadé sur les bords.
    window.addEventListener('pointermove', suivre, { passive: true });
    window.addEventListener('pointerleave', relacher, { passive: true });
    window.addEventListener('blur', relacher);
  }

  // ------------------------------------------------------- les trois scènes
  for (const carte of document.querySelectorAll('[data-tilt]')) {
    let image = null;

    carte.addEventListener('pointermove', (ev) => {
      const r = carte.getBoundingClientRect();
      const x = centre(ev.clientX, r.left, r.width);
      const y = centre(ev.clientY, r.top, r.height);
      if (image) return;
      image = requestAnimationFrame(() => {
        image = null;
        carte.style.setProperty('--try', `${x * 6}deg`);
        carte.style.setProperty('--trx', `${-y * 5}deg`);
      });
    }, { passive: true });

    const reposer = () => {
      carte.style.setProperty('--try', '0deg');
      carte.style.setProperty('--trx', '0deg');
    };
    carte.addEventListener('pointerleave', reposer, { passive: true });
    // Au clavier, l'inclinaison n'apporte rien et peut gêner : on remet à plat.
    carte.addEventListener('focusin', reposer);
  }

  // ------------------------------------------------------------- le contact
  //
  // Le site est statique : il n'a ni serveur ni base pour recevoir un formulaire. Plutôt
  // que de faire semblant — un bouton « Envoyer » qui ne mène nulle part est pire que
  // pas de formulaire — on compose le message dans le logiciel de messagerie du visiteur,
  // qui le relit et l'envoie lui-même. C'est dit sous le bouton.
  const form = document.getElementById('form-contact');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const d = new FormData(form);
      const v = (k) => String(d.get(k) ?? '').trim();

      const societe = v('societe');
      const nom = v('nom');
      if (!societe || !nom || !v('email')) {
        const manquant = form.querySelector('input:invalid, input[required][value=""]')
          || form.querySelector('#f-societe');
        form.reportValidity();
        if (manquant instanceof HTMLElement) manquant.focus();
        return;
      }

      const lignes = [
        'Bonjour,',
        '',
        'Nous souhaitons voir Transpo en démonstration sur nos propres courses.',
        '',
        `Société : ${societe}`,
        `Contact : ${nom} (${v('email')})`,
        `Villes couvertes : ${v('villes') || '—'}`,
        `Nombre de livreurs : ${v('livreurs') || '—'}`,
        '',
        'Ce que nous cherchons à régler :',
        v('message') || '—',
        '',
        'Merci.',
      ];

      const url = `mailto:contact@transpo.ma`
        + `?subject=${encodeURIComponent(`Démonstration Transpo — ${societe}`)}`
        + `&body=${encodeURIComponent(lignes.join('\n'))}`;
      window.location.href = url;

      const note = document.getElementById('form-note');
      if (note) {
        note.textContent = 'Message préparé dans votre logiciel de messagerie. '
          + 'S’il ne s’est pas ouvert, écrivez directement à contact@transpo.ma.';
      }
    });
  }
})();
