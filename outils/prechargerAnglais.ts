// Textes anglais chargés à la demande (#325) : pour un joueur en anglais, src/content/anglais.ts ne demande le
// morceau `anglaisContenu-*.js` qu'une fois le JS d'entrée téléchargé et lancé, soit un aller-retour réseau de plus
// avant l'accueil (≈ 0,4 s en 4G lente). Ce plugin ajoute dans <head> un petit script qui, si la langue sera
// l'anglais, lance tout de suite le téléchargement (`modulepreload`), en parallèle du JS d'entrée.
//
// Le script ne décide rien : il reprend en bref src/content/i18n/detection.ts (choix du Profil, `?lang`, langue de
// l'appareil). S'il se trompe, on télécharge pour rien ou on perd l'avance, rien de plus. Même résultat vérifié
// par outils/prechargerAnglais.test.ts sur les cas de detecterLangue.
import type { Plugin } from 'vite';

/** Corps du script : `LIEN` est remplacé par l'adresse du morceau. Même ordre que `detecterLangue`. */
export const DETECTEUR = `(function () {
  var l = null;
  try { l = JSON.parse(localStorage.getItem('go.langue.v1') || 'null'); } catch (e) {}
  if (l !== 'fr' && l !== 'en') {
    var p = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
    l = p === 'fr' || p === 'en' ? p : null;
  }
  if (!l) {
    var a = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var i = 0; i < a.length && !l; i++) {
      var b = String(a[i] || '').toLowerCase().split(/[-_]/)[0];
      if (b === 'fr' || b === 'en') l = b;
    }
  }
  if (l !== 'en') return;
  var k = document.createElement('link');
  k.rel = 'modulepreload'; k.crossOrigin = ''; k.href = LIEN;
  document.head.appendChild(k);
})();`;

export function scriptPrechargement(lien: string): string {
  return DETECTEUR.replace('LIEN', JSON.stringify(lien));
}

/** Plugin Vite (build seulement) : insère le script si le morceau des textes anglais existe. */
export function prechargerAnglais(): Plugin {
  return {
    name: 'go-precharger-anglais',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const morceau = Object.values(ctx.bundle ?? {}).find(m => m.type === 'chunk' && m.name === 'anglaisContenu');
        if (!morceau) return [];
        return [{ tag: 'script', children: `// #325 : textes anglais en avance (outils/prechargerAnglais.ts)\n${scriptPrechargement(`/${morceau.fileName}`)}`, injectTo: 'head' }];
      },
    },
  };
}
