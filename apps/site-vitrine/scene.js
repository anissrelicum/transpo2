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

  // ------------------------------------------- l'accroche : console + téléphone
  //
  // La console s'incline sous le pointeur, le téléphone se décale un peu plus : c'est la
  // différence de course entre les deux qui donne la profondeur, pas l'angle lui-même.
  // L'inclinaison reste faible — une copie d'écran trop penchée n'est plus lisible, et
  // c'est précisément ce qu'on veut donner à lire.
  const vitre = document.querySelector('[data-scene]');
  const console3d = document.querySelector('[data-tilt-doux]');
  const tel = document.querySelector('[data-flotte-tel]');

  /** Ramène une position dans un rectangle à une valeur de [-1, 1]. */
  const centre = (valeur, debut, taille) => {
    if (!taille) return 0;
    return Math.max(-1, Math.min(1, ((valeur - debut) / taille) * 2 - 1));
  };

  if (vitre && console3d) {
    let image = null;
    const suivre = (ev) => {
      const r = vitre.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;   // hors écran : rien à animer
      const x = centre(ev.clientX, r.left, r.width);
      const y = centre(ev.clientY, r.top, r.height);
      if (image) return;
      image = requestAnimationFrame(() => {
        image = null;
        console3d.style.setProperty('--try', `${x * 3.5}deg`);
        console3d.style.setProperty('--trx', `${-y * 2.5}deg`);
        if (tel) {
          tel.style.setProperty('--fx', `${x * 14}px`);
          tel.style.setProperty('--fy', `${y * 10}px`);
        }
      });
    };
    const relacher = () => {
      console3d.style.setProperty('--try', '0deg');
      console3d.style.setProperty('--trx', '0deg');
      if (tel) { tel.style.setProperty('--fx', '0px'); tel.style.setProperty('--fy', '0px'); }
    };
    window.addEventListener('pointermove', suivre, { passive: true });
    window.addEventListener('pointerleave', relacher, { passive: true });
    window.addEventListener('blur', relacher);
  }

  // ------------------------------------------- les captures dans les sections
  for (const capture of document.querySelectorAll('.capture[data-tilt-doux]')) {
    let image = null;
    capture.addEventListener('pointermove', (ev) => {
      const r = capture.getBoundingClientRect();
      const x = centre(ev.clientX, r.left, r.width);
      const y = centre(ev.clientY, r.top, r.height);
      if (image) return;
      image = requestAnimationFrame(() => {
        image = null;
        capture.style.setProperty('--try', `${x * 4}deg`);
        capture.style.setProperty('--trx', `${-y * 3}deg`);
      });
    }, { passive: true });
    const reposer = () => {
      capture.style.setProperty('--try', '0deg');
      capture.style.setProperty('--trx', '0deg');
    };
    capture.addEventListener('pointerleave', reposer, { passive: true });
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
