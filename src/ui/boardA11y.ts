// Clavier et lecteur d'écran du goban (issue #116) : fonctions pures, testées sans DOM.
// Coordonnées lues comme affichées : lettres A à T sans I, lignes numérotées depuis le bas (src/go/coords.ts).
import { toLabel } from '../go/coords';
import { groupAt, neighbors } from '../go/rules';
import { t } from '../content/i18n';

/** Nom de chaque camp pour le lecteur d'écran : 1 noir, 2 blanc. Un camp absent garde « Noir » ou « Blanc ». */
export type NomsCamps = { 1?: string; 2?: string };

/** Touche qui lit tout le plateau (« L » comme « Lire », et « Look » en anglais). */
export const TOUCHE_LIRE = 'l';

/**
 * Couleurs du curseur clavier, posées sur le bois : un liseré presque noir sous un anneau jade clair (#4CD39B : le jade #3CC48E n'atteint pas 3:1 sur le reflet des pierres noires).
 * Le liseré garde au moins 3:1 (WCAG 1.4.11) sur tous les bois et sur les pierres blanches ; le jade, sur les pierres noires.
 * Le goban est le même en mode sombre et en mode clair : seul son thème (#109) change le fond.
 */
export const CURSEUR = { lisere: '#0B1A14', anneau: '#4CD39B' } as const;

/** Nouvelle position du curseur après une touche, ou null si la touche ne déplace pas le curseur. */
export function deplacerCurseur(p: number, touche: string, size: number): number | null {
  const x = p % size, y = Math.floor(p / size), fin = size - 1;
  const en = (nx: number, ny: number) => Math.max(0, Math.min(fin, ny)) * size + Math.max(0, Math.min(fin, nx));
  switch (touche) {
    case 'ArrowLeft': return en(x - 1, y);
    case 'ArrowRight': return en(x + 1, y);
    case 'ArrowUp': return en(x, y - 1);
    case 'ArrowDown': return en(x, y + 1);
    case 'Home': return en(0, y);
    case 'End': return en(fin, y);
    case 'PageUp': return en(x, 0);
    case 'PageDown': return en(x, fin);
    default: return null;
  }
}

/** Nom lu d'une intersection : « D4, vide », « D4, pierre noire » ou « D4, pierre blanche, dernier coup ». */
export function nomIntersection(p: number, board: Int8Array, size: number, last = -1): string {
  const c = board[p], point = toLabel(p, size);
  const intersection = t(c === 1 ? 'plateau.pierreNoire' : c === 2 ? 'plateau.pierreBlanche' : 'plateau.vide', { point });
  return c && p === last ? t('plateau.dernierCoup', { intersection }) : intersection;
}

/** Annonce polie d'un coup : « Noir joue D4 » ou « Blanc joue C3 et prend 2 pierres ». */
export function annonceCoup(c: number, p: number, prises: number, size: number, noms: NomsCamps = {}): string {
  // Un camp nommé dit « Pomme a joué C3 » : ne répète pas mot pour mot le message visible « Pomme joue C3. À toi. ».
  const nom = c === 1 ? noms[1] : noms[2];
  const point = toLabel(p, size);
  const coup = nom ? t('plateau.aJoue', { nom, point }) : t('plateau.joue', { camp: t(c === 1 ? 'camp.noir' : 'camp.blanc'), point });
  return prises ? t('plateau.prend', { coup, n: prises }) : coup;
}

/**
 * Atari après un coup en `p` : les groupes adverses voisins réduits à une seule liberté.
 * « Atari : ta pierre D4 n'a plus qu'une liberté, en D5. » (le mot est expliqué dans la phrase). Chaîne vide sinon.
 * Si le camp menacé a un nom (l'adversaire), la phrase le cite : « la pierre D4 de Pomme ».
 */
export function annonceAtari(board: Int8Array, p: number, size: number, noms: NomsCamps = {}): string {
  const c = board[p];
  if (!c) return '';
  const vus = new Set<number>(), phrases: string[] = [];
  for (const q of neighbors(size)[p]) {
    if (board[q] !== 3 - c || vus.has(q)) continue;
    const g = groupAt(board, size, q);
    g.stones.forEach(s => vus.add(s));
    if (g.liberties.size !== 1) continue;
    const lib = toLabel([...g.liberties][0], size);
    const pts = g.stones.map(s => toLabel(s, size)).sort().join(', ');
    const autre = c === 1 ? noms[2] : noms[1], plusieurs = g.stones.length > 1;
    phrases.push(autre
      ? t(plusieurs ? 'plateau.atari.pierresDe' : 'plateau.atari.pierreDe', { pierres: pts, nom: autre, liberte: lib })
      : t(plusieurs ? 'plateau.atari.tesPierres' : 'plateau.atari.taPierre', { pierres: pts, liberte: lib }));
  }
  return phrases.join(' ');
}

/** Annonce complète après un coup posé en `p` : le coup, les prises, puis l'atari éventuel. */
export function annonceApresCoup(board: Int8Array, p: number, prises: number, size: number, noms: NomsCamps = {}): string {
  const atari = annonceAtari(board, p, size, noms);
  const coup = annonceCoup(board[p], p, prises, size, noms);
  return atari ? `${coup}. ${atari}` : coup;
}

/** Annonce après le premier Entrée quand la confirmation est active. */
export function annonceConfirmation(label: string, toucher = false): string {
  return t(toucher ? 'plateau.confirmer.choisir' : 'plateau.confirmer.poser', { point: label });
}

/**
 * « Lire le plateau » : le compte des pierres, puis les lignes occupées de haut en bas (ligne 9 d'abord sur un 9 × 9),
 * chaque ligne de gauche à droite. « 2 pierres noires, 1 pierre blanche. Ligne 5 : D5 noire, E5 blanche. … »
 */
export function lirePlateau(board: Int8Array, size: number): string {
  let noires = 0, blanches = 0;
  const lignes: string[] = [];
  for (let y = 0; y < size; y++) {
    const pierres: string[] = [];
    for (let x = 0; x < size; x++) {
      const p = y * size + x, c = board[p];
      if (c !== 1 && c !== 2) continue;
      if (c === 1) noires++; else blanches++;
      pierres.push(t(c === 1 ? 'plateau.lire.noire' : 'plateau.lire.blanche', { point: toLabel(p, size) }));
    }
    if (pierres.length) lignes.push(t('plateau.lire.ligne', { ligne: size - y, pierres: pierres.join(', ') }));
  }
  if (!lignes.length) return t('plateau.lire.vide');
  const compte = t('plateau.lire.compte', { noires: t('plateau.lire.nbNoires', { n: noires }), blanches: t('plateau.lire.nbBlanches', { n: blanches }) });
  const fin = lignes.length < size ? [t('plateau.lire.autresVides')] : [];
  return [compte, ...lignes, ...fin].join(' ');
}
