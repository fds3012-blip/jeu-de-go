// « Partager pour recruter » (#364, décision de Florian du 05/10). Logique pure, sans React ni réseau.
// - `sgfPublic` : la partie réduite à ce qui se partage (coups, taille, komi, règles, handicap, résultat) : jamais un nom,
//   un commentaire, une date ni un lieu (même règle côté serveur : `sgf_partageable`,
//   supabase/migrations/20261005213100_parties_partagees.sql).
// - Liens courts : `mochi-go.app/partie#JETON` (ici), `mochi-go.app/defi#JETON` (src/data/defi.ts), `mochi-go.app/j/42`
//   (src/app/goDuJour.ts), et `/en/…`. Chacun a sa
//   page d'aperçu (Open Graph, outils/apercus.ts) ; index.html les remet à la forme habituelle avant tout le reste.
// - Nom du fichier SGF : `adversaire-date.sgf`.
import { readSgf } from '../go/sgf';
import { toSgf } from '../go/coords';
import type { Langue } from '../content/i18n';

// Jeton et lecture de l'adresse : src/app/adressePartie.ts (JS initial, gardé léger : ce module-ci n'y entre pas).
export { FORMAT_JETON_PARTIE, PARAM_PARTIE, jetonPartieDeLAdresse } from './adressePartie';
/** Adresse publique du jeu. */
export const SITE = 'https://mochi-go.app';
/** Taille maximale d'un SGF partagé (octets), comme le serveur. */
export const MAX_SGF_PARTAGE = 16_384;

/** Adversaire montré à l'ami : nom de l'échelle ou pseudo, jamais un nom de fichier ou une phrase. */
const FORMAT_ADVERSAIRE = /^[A-Za-z0-9À-ÿ _'’.-]{1,24}$/;

/** Résultat SGF normalisé (`B+6.5`, `W+R`, `B+T`, `0`), ou undefined s'il ne se lit pas. */
export function resultatPublic(re: string | undefined): string | undefined {
  const r = re?.trim() ?? '';
  const m = /^([BW])\+(.*)$/i.exec(r);
  if (m) {
    const c = m[1].toUpperCase(), v = m[2].trim();
    if (/^\d{1,3}(\.\d{1,2})?$/.test(v)) return `${c}+${v}`;
    if (/^r(esign)?$/i.test(v)) return `${c}+R`;
    if (/^t(ime)?$/i.test(v)) return `${c}+T`;
    if (/^f(orfeit)?$/i.test(v)) return `${c}+F`;
    return undefined;
  }
  if (/^(0|draw|jigo)$/i.test(r)) return '0';
  return undefined;
}

export interface SgfPublic { sgf: string; taille: number; coups: number }

/**
 * La partie réduite à ce qui se partage. Lève une erreur si le SGF ne se lit pas.
 * Passes notées `tt`, comme partout dans le projet ; komi borné à 2 décimales.
 */
export function sgfPublic(sgf: string): SgfPublic {
  const g = readSgf(sgf);
  const komi = Math.round(g.komi * 100) / 100;
  let s = `(;GM[1]FF[4]CA[UTF-8]SZ[${g.size}]KM[${Number.isFinite(komi) && Math.abs(komi) < 1000 ? komi : 6.5}]`
    + `RU[${g.rules === 'chinese' ? 'Chinese' : 'Japanese'}]`;
  if (g.handicap && g.handicap >= 2 && g.handicap <= 9) s += `HA[${g.handicap}]`;
  const re = resultatPublic(g.result);
  if (re) s += `RE[${re}]`;
  if (g.setupBlack.length) s += 'AB' + g.setupBlack.map(p => `[${toSgf(p, g.size)}]`).join('');
  if (g.setupWhite.length) s += 'AW' + g.setupWhite.map(p => `[${toSgf(p, g.size)}]`).join('');
  if (g.toPlay) s += `PL[${g.toPlay === 1 ? 'B' : 'W'}]`;
  for (const m of g.moves) s += `;${m.color === 1 ? 'B' : 'W'}[${m.p < 0 ? 'tt' : toSgf(m.p, g.size)}]`;
  return { sgf: `${s})`, taille: g.size, coups: g.moves.length };
}

/** Ajoute le nom des deux camps (PB, PW) à un SGF public, pour le fichier téléchargé. */
export function sgfAvecCamps(sgf: string, camps: { noir: string; blanc: string }): string {
  const esc = (v: string) => v.replace(/([\]\\])/g, '\\$1');
  return sgf.replace(/^\(;GM\[1\]/, `(;GM[1]PB[${esc(camps.noir)}]PW[${esc(camps.blanc)}]`);
}

/** Le SGF tient-il dans un partage (taille du serveur) ? */
export const partageable = (sgf: string): boolean => new TextEncoder().encode(sgf).length <= MAX_SGF_PARTAGE;

/** Adversaire publiable, ou null. */
export function adversairePublic(nom: string | null | undefined): string | null {
  const n = nom?.trim() ?? '';
  return FORMAT_ADVERSAIRE.test(n) ? n : null;
}

/** Morceau de nom de fichier : minuscules sans accent, tirets. */
function morceau(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}

/** Nom du fichier SGF : `tigre-2026-10-05.sgf` (`partie-…` sans adversaire). Date du jour de l'appareil. */
export function nomFichierSgf(adversaire: string | null | undefined, date: Date): string {
  const j = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${morceau(adversaire ?? '') || 'partie'}-${j}.sgf`;
}

/** Nom de l'image du moment clé : même base que le SGF. */
export const nomFichierImage = (adversaire: string | null | undefined, date: Date): string => nomFichierSgf(adversaire, date).replace(/\.sgf$/, '.png');

/**
 * Origine des liens partagés : l'adresse publique quand l'app tourne sur mochi-go.app (liens courts, aperçu riche),
 * sinon l'origine courante (préversions, tests), pour que le lien ouvre la même app.
 */
export function originePartage(loc: Pick<Location, 'hostname' | 'origin'> | undefined = typeof location === 'undefined' ? undefined : location): string {
  if (!loc) return SITE;
  return /(^|\.)mochi-go\.app$/.test(loc.hostname) ? SITE : loc.origin.replace(/\/+$/, '');
}

/** Préfixe de langue des liens courts : la page d'aperçu est en anglais pour un joueur en anglais. */
const prefixe = (l: Langue) => (l === 'en' ? '/en' : '');

/** Lien de la revue partagée : `https://mochi-go.app/partie#JETON` (`/en/partie#…` en anglais). */
export function lienPartie(jeton: string, l: Langue, origine = originePartage()): string {
  return `${origine}${prefixe(l)}/partie#${jeton}`;
}

