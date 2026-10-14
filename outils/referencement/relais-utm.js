// Relais des paramètres UTM (#537) : un visiteur arrive sur une page d'entrée par un lien de campagne
// (`/go-pour-joueurs-echecs?utm_source=reddit&utm_medium=social&utm_campaign=lancement`). Le bouton « Jouer maintenant »
// porte d'office la campagne de la page (`utm_source=mochi-go&utm_medium=page&utm_campaign=go-echecs`) : sans ce relais,
// PostHog attribuerait le joueur à la page au lieu du canal qui l'a amené. Le relais remplace les UTM du bouton par ceux
// de l'arrivée et garde le nom de la page dans `utm_content` (sauf si l'arrivée en porte déjà un).
// Valeurs acceptées : lettres, chiffres, `_`, `.`, `~`, `-`, 64 caractères au plus ; tout le reste est ignoré.
// Sans JS ou sans `utm_source` valide à l'arrivée : le bouton garde son lien d'origine.
// Inliné et minifié dans chaque page (outils/referencement/pages.ts) ; testé dans Node (pages.test.ts).

/* exported relayerUtm */
const CLES_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const VALEUR_UTM = /^[\w.~-]{1,64}$/;

/** Lien du bouton (`/?lang=fr&utm_…`) avec les UTM de l'arrivée (`location.search`). */
function relayerUtm(href, search) {
  const arrivee = new URLSearchParams(search);
  const source = arrivee.get('utm_source');
  if (!source || !VALEUR_UTM.test(source)) return href;
  const q = href.indexOf('?');
  const chemin = q < 0 ? href : href.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : href.slice(q + 1));
  const page = params.get('utm_campaign');
  CLES_UTM.forEach(function (k) {
    params.delete(k);
    const v = arrivee.get(k);
    if (v && VALEUR_UTM.test(v)) params.set(k, v);
  });
  if (!params.get('utm_content') && page) params.set('utm_content', page);
  return chemin + '?' + params.toString();
}

if (typeof document !== 'undefined') {
  try {
    const boutons = document.querySelectorAll('a.cta');
    for (let i = 0; i < boutons.length; i++) boutons[i].setAttribute('href', relayerUtm(boutons[i].getAttribute('href'), location.search));
  } catch { /* lien d'origine gardé */ }
}
