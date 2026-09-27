// Récit du score en fin de partie (issue #78) : territoires, prisonniers, komi, résultat.
// Logique pure : les étapes et leurs totaux viennent du comptage de src/go/score.ts, jamais d'un calcul à part.
import { score, type Rules } from '../go/score';
import type { Position } from '../go/rules';

const virgule = (n: number) => String(n).replace('.', ',');

/** Horloge du récit, en ms. Tout est fini à DUREE_RECIT (2,5 s au plus, exigence de l'issue). */
export const TEMPS = { territoire: 0, etalement: 1100, prisonniers: 1350, komi: 1800, resultat: 2250 } as const;
export const DUREE_RECIT = 2500;
/** Pause de lecture sur le résultat, sans mouvement, avant l'écran de fin. */
export const PAUSE_LECTURE = 1200;
/** Durée d'apparition d'un carré de territoire (board.css, go-territoire). */
export const DUREE_CARRE = 200;

export interface PointTerritoire { p: number; c: 1 | 2; delai: number }

export interface Recit {
  /** Intersections de territoire dans l'ordre de lecture, avec leur délai d'apparition. */
  territoire: PointTerritoire[];
  territoireNoir: number;
  territoireBlanc: number;
  /** Deuxième temps : prisonniers (japonais) ou pierres vivantes (chinois). */
  deuxieme: { type: 'prisonniers' | 'pierres'; noir: number; blanc: number };
  komi: number;
  noir: number;
  blanc: number;
  gagnant: 0 | 1 | 2;
  marge: number;
}

/** Construit le récit à partir du comptage de src/go (mêmes règles, mêmes pierres mortes). */
export function recitScore(pos: Position, komi: number, rules: Rules = 'japanese', dead: Set<number> = new Set()): Recit {
  const sc = score(pos, komi, rules, dead);
  const pts: { p: number; c: 1 | 2 }[] = [];
  for (let p = 0; p < sc.owner.length; p++) if (sc.owner[p] === 1 || sc.owner[p] === 2) pts.push({ p, c: sc.owner[p] as 1 | 2 });
  const pas = pts.length > 1 ? Math.min(40, TEMPS.etalement / (pts.length - 1)) : 0;
  const territoire = pts.map((t, i) => ({ ...t, delai: Math.round(TEMPS.territoire + i * pas) }));
  // Le deuxième temps se déduit du total de src/go : ce qui n'est pas territoire (ni komi) est prisonnier ou pierre vivante.
  const noir2 = sc.black - sc.territory[1], blanc2 = sc.white - komi - sc.territory[2];
  const marge = sc.black === sc.white ? 0 : sc.margin;
  return {
    territoire, territoireNoir: sc.territory[1], territoireBlanc: sc.territory[2],
    deuxieme: { type: rules === 'japanese' ? 'prisonniers' : 'pierres', noir: noir2, blanc: blanc2 },
    komi, noir: sc.black, blanc: sc.white, gagnant: marge === 0 ? 0 : sc.winner, marge,
  };
}

export interface EtatRecit { etape: 0 | 1 | 2 | 3 | 4; noir: number; blanc: number }

/**
 * Ce qu'on affiche au temps `t` (ms) : étape atteinte et compteurs.
 * 1 territoires (le compteur monte avec les carrés), 2 prisonniers, 3 komi, 4 résultat.
 */
export function etatRecit(r: Recit, t: number): EtatRecit {
  if (t >= TEMPS.resultat) return { etape: 4, noir: r.noir, blanc: r.blanc };
  let noir = 0, blanc = 0;
  for (const q of r.territoire) if (q.delai <= t) q.c === 1 ? noir++ : blanc++;
  if (t < TEMPS.prisonniers) return { etape: 1, noir, blanc };
  noir = r.territoireNoir + r.deuxieme.noir; blanc = r.territoireBlanc + r.deuxieme.blanc;
  if (t < TEMPS.komi) return { etape: 2, noir, blanc };
  return { etape: 3, noir, blanc: blanc + r.komi };
}

const pluriel = (n: number, mot: string) => `${virgule(n)} ${mot}${Math.abs(n) >= 2 ? 's' : ''}`;

/**
 * Noms des deux camps dans le récit (#118). À deux : « Noir » et « Blanc ». Contre l'ordi : « Toi » et son nom
 * (« Pomme ») ; `toi` sert dans les phrases (« pour toi », « Tu gagnes »).
 */
export interface Camps { noir: string; blanc: string; toi: boolean }
export const CAMPS_DEUX: Camps = { noir: 'Noir', blanc: 'Blanc', toi: false };

/** Camps du récit : contre l'ordi (`adversaire` = son nom), « Toi » a Noir ; sinon Noir et Blanc. */
export function campsRecit(adversaire?: string): Camps {
  return adversaire ? { noir: 'Toi', blanc: adversaire, toi: true } : CAMPS_DEUX;
}

/** Nom d'un camp au milieu d'une phrase : « pour toi », « pour Pomme », « pour Noir ». */
const dans = (c: Camps, camp: 1 | 2) => (camp === 1 ? (c.toi ? 'toi' : c.noir) : c.blanc);

/** Ligne du deuxième temps : « + 3 prisonniers pour Noir, + 1 pour Blanc » (contre l'ordi : « pour toi », « pour Pomme »). */
export function ligneDeuxieme(r: Recit, c: Camps = CAMPS_DEUX): string {
  const { type, noir, blanc } = r.deuxieme, mot = type === 'prisonniers' ? 'prisonnier' : 'pierre';
  if (!noir && !blanc) return type === 'prisonniers' ? 'Aucun prisonnier' : 'Aucune pierre';
  if (!blanc) return `+ ${pluriel(noir, mot)} pour ${dans(c, 1)}`;
  if (!noir) return `+ ${pluriel(blanc, mot)} pour ${dans(c, 2)}`;
  return `+ ${pluriel(noir, mot)} pour ${dans(c, 1)}, + ${virgule(blanc)} pour ${dans(c, 2)}`;
}

/** « + 6,5 komi pour Blanc » (contre l'ordi « pour Pomme » ; un komi négatif, en test, s'écrit « − 100 »). */
export function ligneKomi(komi: number, c: Camps = CAMPS_DEUX): string {
  if (!komi) return 'Pas de komi';
  return `${komi < 0 ? '−' : '+'} ${virgule(Math.abs(komi))} komi pour ${dans(c, 2)}`;
}

export const EXPLICATION_KOMI = "Le komi compense l'avantage de Noir, qui joue en premier.";

/** « Noir gagne de 2,5 points » à deux ; contre l'ordi « Tu gagnes de 3,5 points ! » ou « Pomme gagne de 2,5 points ». */
export function ligneResultat(r: Recit, c: Camps = CAMPS_DEUX): string {
  if (!r.gagnant) return 'Égalité';
  const marge = pluriel(r.marge, 'point');
  if (r.gagnant === 1 && c.toi) return `Tu gagnes de ${marge} !`;
  return `${r.gagnant === 1 ? c.noir : c.blanc} gagne de ${marge}`;
}

/** Compteur : « Noir 18 · Blanc 12 ». */
export function ligneCompteur(noir: number, blanc: number): string {
  return `Noir ${virgule(noir)} · Blanc ${virgule(blanc)}`;
}
