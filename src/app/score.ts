// Récit du score en fin de partie (issue #78) : territoires, prisonniers, komi, résultat.
// Logique pure : les étapes et leurs totaux viennent du comptage de src/go/score.ts, jamais d'un calcul à part.
import { score, type Rules } from '../go/score';
import type { Position } from '../go/rules';
import { nombre, t } from '../content/i18n/secondaires';

/** Horloge du récit, en ms. Tout est fini à DUREE_RECIT (2,5 s ; l'issue demande moins de 4 s, pause de lecture comprise). */
export const TEMPS = { territoire: 0, etalement: 1100, prisonniers: 1350, komi: 1800, resultat: 2250 } as const;
export const DUREE_RECIT = 2500;
/** Pause de lecture sur le résultat, sans mouvement, avant l'écran de fin. */
export const PAUSE_LECTURE = 1200;
/** Durée d'apparition d'un carré de territoire (board.css, go-territoire). */
export const DUREE_CARRE = 200;
/**
 * Prisonniers et komi « rejoignent leur camp » : un jeton monte vers le compteur (fin.css, recit-jeton, 420 ms)
 * et le chiffre change quand il arrive, pas avant.
 */
export const ARRIVEE_JETON = 260;

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
export interface Totaux { noir: number; blanc: number }

/**
 * Les trois temps du récit et le total atteint à la fin de chacun : territoires, puis + prisonniers
 * (ou pierres vivantes en chinois), puis + komi. Le dernier est le score de src/go.
 */
export function totauxEtapes(r: Recit): [Totaux, Totaux, Totaux] {
  const t1 = { noir: r.territoireNoir, blanc: r.territoireBlanc };
  const t2 = { noir: t1.noir + r.deuxieme.noir, blanc: t1.blanc + r.deuxieme.blanc };
  return [t1, t2, { noir: r.noir, blanc: r.blanc }];
}

/**
 * Ce qu'on affiche au temps `t` (ms) : étape atteinte et compteurs.
 * 1 territoires (le compteur monte avec les carrés), 2 prisonniers, 3 komi, 4 résultat.
 * Aux étapes 2 et 3, le chiffre change quand le jeton arrive dans le camp (ARRIVEE_JETON).
 */
export function etatRecit(r: Recit, t: number): EtatRecit {
  const [t1, t2, t3] = totauxEtapes(r);
  if (t >= TEMPS.resultat) return { etape: 4, ...t3 };
  if (t >= TEMPS.komi) return { etape: 3, ...(t >= TEMPS.komi + ARRIVEE_JETON ? t3 : t2) };
  if (t >= TEMPS.prisonniers) return { etape: 2, ...(t >= TEMPS.prisonniers + ARRIVEE_JETON ? t2 : t1) };
  let noir = 0, blanc = 0;
  for (const q of r.territoire) if (q.delai <= t) q.c === 1 ? noir++ : blanc++;
  return { etape: 1, noir, blanc };
}

/** Jetons qui rejoignent les camps à l'étape 2 (prisonniers) ou 3 (komi) ; 0 : pas de jeton pour ce camp. */
export function jetonsEtape(r: Recit, etape: number): Totaux {
  if (etape === 2) return { noir: r.deuxieme.noir, blanc: r.deuxieme.blanc };
  if (etape === 3) return { noir: 0, blanc: r.komi };
  return { noir: 0, blanc: 0 };
}

/**
 * Noms des deux camps dans le récit (#118). À deux : « Noir » et « Blanc ». Contre l'ordi : « Toi » et son nom
 * (« Pomme ») ; `toi` sert dans les phrases (« pour toi », « Tu gagnes »).
 */
export interface Camps { noir: string; blanc: string; toi: boolean }
/** Camps d'une partie à deux, en français (texte d'origine) ; l'interface passe par `campsRecit()` (#167). */
export const CAMPS_DEUX: Camps = { noir: 'Noir', blanc: 'Blanc', toi: false };

/** Camps du récit : contre l'ordi (`adversaire` = son nom), « Toi » a Noir ; sinon Noir et Blanc. */
export function campsRecit(adversaire?: string): Camps {
  return adversaire ? { noir: t('camp.toi'), blanc: adversaire, toi: true } : { noir: t('camp.noir'), blanc: t('camp.blanc'), toi: false };
}

/** Nom d'un camp au milieu d'une phrase : « pour toi », « pour Pomme », « pour Noir ». */
const dans = (c: Camps, camp: 1 | 2) => (camp === 1 ? (c.toi ? t('camp.toiDans') : c.noir) : c.blanc);

/** « + 3 prisonniers pour Noir » : `v` affiché avec la virgule, accord selon `n`. */
const plus = (type: Recit['deuxieme']['type'], n: number, pour: string) =>
  t(type === 'prisonniers' ? 'recit.prisonniers' : 'recit.pierres', { n, v: nombre(n), pour });

/** Premier temps : « 36 points de territoire pour Noir, 27 pour Blanc » (contre l'ordi : « pour toi », « pour Pomme »). */
export function ligneTerritoire(r: Recit, c: Camps = campsRecit()): string {
  const noir = r.territoireNoir, blanc = r.territoireBlanc;
  const un = (n: number, camp: 1 | 2) => t('recit.territoire', { n, v: nombre(n), pour: dans(c, camp) });
  if (!noir && !blanc) return t('recit.aucunTerritoire');
  if (!blanc) return un(noir, 1);
  if (!noir) return un(blanc, 2);
  return t('recit.etAussi', { debut: un(noir, 1), v: nombre(blanc), pour: dans(c, 2) });
}

/** Ligne du deuxième temps : « +3 prisonniers pour Noir, +1 pour Blanc » (contre l'ordi : « pour toi », « pour Pomme »). */
export function ligneDeuxieme(r: Recit, c: Camps = campsRecit()): string {
  const { type, noir, blanc } = r.deuxieme;
  if (!noir && !blanc) return t(type === 'prisonniers' ? 'recit.aucunPrisonnier' : 'recit.aucunePierre');
  if (!blanc) return plus(type, noir, dans(c, 1));
  if (!noir) return plus(type, blanc, dans(c, 2));
  return t('recit.etPour', { debut: plus(type, noir, dans(c, 1)), v: nombre(blanc), pour: dans(c, 2) });
}

/**
 * « +6,5 komi pour Blanc » (contre l'ordi « pour Pomme » ; un komi négatif, en test, s'écrit « −100 »). Recette du 02/10
 * au soir (L7) : le signe colle au nombre, sinon « − 100 » se lit comme un tiret long.
 */
export function ligneKomi(komi: number, c: Camps = campsRecit()): string {
  if (!komi) return t('recit.pasDeKomi');
  return t('recit.komi', { signe: komi < 0 ? '−' : '+', v: nombre(Math.abs(komi)), pour: dans(c, 2) });
}

export const EXPLICATION_KOMI = "Le komi compense l'avantage de Noir, qui joue en premier.";

/** « Noir gagne de 2,5 points » à deux ; contre l'ordi « Tu gagnes de 3,5 points ! » ou « Pomme gagne de 2,5 points ». */
export function ligneResultat(r: Recit, c: Camps = campsRecit()): string {
  if (!r.gagnant) return t('recit.egalite');
  const marge = { n: r.marge, v: nombre(r.marge) };
  if (r.gagnant === 1 && c.toi) return t('recit.tuGagnes', marge);
  return t('recit.gagne', { ...marge, nom: r.gagnant === 1 ? c.noir : c.blanc });
}

/** Compteur : « Noir 18 · Blanc 12 ». */
export function ligneCompteur(noir: number, blanc: number): string {
  return t('recit.compteur', { noir: nombre(noir), blanc: nombre(blanc) });
}
