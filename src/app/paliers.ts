// Problèmes par paliers (issue #93) : logique pure, sans React.
//
// Bornes retenues (difficulté = cote Elo du problème) :
//   Débutant        < 450
//   Novice          450 à 649
//   Apprenti        650 à 849
//   Joueur de club  850 à 1049
//   Confirmé        ≥ 1050
// Bornes réparties pour les lots de #91 (difficultés de 300 à 1300). Avec les 18 problèmes de #11 et #16
// seuls, les 4 premiers paliers en ont (3, 6, 7 et 2) et Confirmé est vide, ce qui est voulu.
// Un palier vide ne bloque pas le suivant et n'est pas affiché.
// Les lots de #91 viennent se ranger dans ces paliers sans rien changer ici.

export type PalierId = 'debutant' | 'novice' | 'apprenti' | 'club' | 'confirme';

export interface DefPalier {
  id: PalierId;
  nom: string;
  /** Rang du go correspondant, en kyu. */
  kyu: string;
  /** Difficulté minimale incluse (la maximale est le min du palier suivant, exclue). */
  min: number;
}

export const PALIERS: readonly DefPalier[] = [
  { id: 'debutant', nom: 'Débutant', kyu: '30 à 25 kyu', min: -Infinity },
  { id: 'novice', nom: 'Novice', kyu: '24 à 20 kyu', min: 450 },
  { id: 'apprenti', nom: 'Apprenti', kyu: '19 à 15 kyu', min: 650 },
  { id: 'club', nom: 'Joueur de club', kyu: '14 à 10 kyu', min: 850 },
  { id: 'confirme', nom: 'Confirmé', kyu: '9 kyu et plus', min: 1050 }
];

/** Part du palier précédent à réussir pour ouvrir le suivant. */
export const SEUIL_OUVERTURE = 0.6;

export interface Palier<T> extends DefPalier {
  rang: number;
  problemes: T[];
  reussis: number;
  total: number;
  ouvert: boolean;
  /** Tous les problèmes du palier sont réussis (et il en contient au moins un). */
  complet: boolean;
}

/** Index du palier d'une difficulté (ou d'une cote de joueur). */
export function indexPalier(difficulte: number): number {
  let i = 0;
  for (let k = 0; k < PALIERS.length; k++) if (difficulte >= PALIERS[k].min) i = k;
  return i;
}

/**
 * Découpe les problèmes en paliers, en gardant l'ordre de la liste dans chaque palier
 * (trié par difficulté, puis identifiant). Un palier est ouvert si le précédent est réussi à 60 % ou plus ;
 * un palier vide ne bloque pas le suivant ; le premier est toujours ouvert.
 */
export function paliers<T extends { id: string; difficulty: number }>(liste: T[], reussis: Set<string>): Palier<T>[] {
  const tries = [...liste].sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  const groupes = PALIERS.map(() => [] as T[]);
  for (const p of tries) groupes[indexPalier(p.difficulty)].push(p);
  const out: Palier<T>[] = [];
  PALIERS.forEach((d, i) => {
    const problemes = groupes[i];
    const n = problemes.filter(p => reussis.has(p.id)).length;
    const prev = out[i - 1];
    const ouvert = !prev || (prev.ouvert && (prev.total === 0 || prev.reussis / prev.total >= SEUIL_OUVERTURE));
    out.push({ ...d, rang: i + 1, problemes, reussis: n, total: problemes.length, ouvert, complet: problemes.length > 0 && n === problemes.length });
  });
  return out;
}

/** Problèmes dans l'ordre des paliers : c'est l'ordre de la grille et de « Problème suivant ». */
export function ordrePaliers<T>(ps: Palier<T>[]): T[] {
  return ps.flatMap(p => p.problemes);
}

/**
 * Prochain problème à faire : le premier non réussi du palier ouvert le plus avancé.
 * Si ce palier est entièrement réussi, le premier non réussi d'un palier ouvert, du plus avancé au premier.
 */
export function prochain<T extends { id: string }>(ps: Palier<T>[], reussis: Set<string>): T | undefined {
  const ouverts = ps.filter(p => p.ouvert && p.total > 0).reverse();
  for (const p of ouverts) {
    const pb = p.problemes.find(x => !reussis.has(x.id));
    if (pb) return pb;
  }
  return undefined;
}

/** Problème à proposer après `courant`, dans l'ordre des paliers, parmi les paliers ouverts. */
export function suivantPalier<T extends { id: string }>(ps: Palier<T>[], courant: T, reussis: Set<string>): T | undefined {
  const jouables = ps.filter(p => p.ouvert).flatMap(p => p.problemes);
  const i = jouables.findIndex(p => p.id === courant.id);
  const apres = i < 0 ? [] : jouables.slice(i + 1);
  return apres.find(p => !reussis.has(p.id)) ?? jouables.find(p => !reussis.has(p.id) && p.id !== courant.id);
}

/**
 * Problème à proposer quand plus rien n'est à faire (issue #147) : un problème déjà réussi, tiré au hasard
 * parmi les paliers ouverts, jamais `eviter` (le dernier joué) sauf s'il est le seul.
 */
export function auHasard<T extends { id: string }>(ps: Palier<T>[], eviter?: string, alea: () => number = Math.random): T | undefined {
  const jouables = ps.filter(p => p.ouvert).flatMap(p => p.problemes);
  const autres = jouables.filter(p => p.id !== eviter);
  const pool = autres.length ? autres : jouables;
  if (!pool.length) return undefined;
  return pool[Math.min(pool.length - 1, Math.floor(alea() * pool.length))];
}

/** « Continuer » : le prochain non résolu, sinon un problème réussi au hasard (jamais `dernier`). */
export function aContinuer<T extends { id: string }>(ps: Palier<T>[], reussis: Set<string>, dernier?: string, alea?: () => number): T | undefined {
  return prochain(ps, reussis) ?? auHasard(ps, dernier, alea);
}

/** « Problème suivant » : le suivant non résolu, sinon un problème réussi au hasard, jamais `courant`. */
export function aSuivre<T extends { id: string }>(ps: Palier<T>[], courant: T, reussis: Set<string>, alea?: () => number): T | undefined {
  return suivantPalier(ps, courant, reussis) ?? auHasard(ps, courant.id, alea);
}

/**
 * Palier recommandé pour un joueur connecté, selon sa cote : celui dont les problèmes ont sa difficulté,
 * sans dépasser le palier ouvert le plus avancé. `undefined` sans cote.
 */
export function palierRecommande<T>(ps: Palier<T>[], cote: number | undefined): PalierId | undefined {
  if (cote === undefined || !Number.isFinite(cote)) return undefined;
  let i = indexPalier(cote);
  while (i > 0 && !ps[i]?.ouvert) i--;
  return ps[i]?.id;
}

/**
 * Palier en cours (issue #196) : le palier ouvert le plus avancé qui reste à finir (celui de « Continuer »),
 * sinon le dernier palier ouvert non vide. C'est le seul palier montré sur l'écran Problèmes.
 */
export function palierEnCours<T>(ps: Palier<T>[]): Palier<T> | undefined {
  const ouverts = ps.filter(p => p.ouvert && p.total > 0);
  return [...ouverts].reverse().find(p => !p.complet) ?? ouverts[ouverts.length - 1];
}

/**
 * Paliers de la liste « Tous les problèmes » (issue #196) : les paliers ouverts, puis le premier palier fermé seul,
 * annoncé sans ses miniatures. Aucun mur de cadenas, aucun total : la suite reste une surprise.
 */
export function paliersVisibles<T>(ps: Palier<T>[]): { ouverts: Palier<T>[]; prochain?: Palier<T> } {
  const nonVides = ps.filter(p => p.total > 0);
  return { ouverts: nonVides.filter(p => p.ouvert), prochain: nonVides.find(p => !p.ouvert) };
}
