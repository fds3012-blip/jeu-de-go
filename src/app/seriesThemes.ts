// Problèmes par thème (issue #471) : six séries (Capturer, Sauver, Vie et mort, Relier et couper, Fin de partie,
// Tesuji), une difficulté qui suit la cote « à ta mesure » (#284, jamais affichée : décision #137), un compteur de
// réussites d'affilée et un record par série. Logique pure, sans React.
//
// Aucun nouveau problème : chaque série regroupe des thèmes déjà attribués à la banque (src/content/themes.ts, #200).
// Une série qui n'a pas au moins MIN_PAR_SERIE problèmes n'est pas affichée.
//
// Stockage : sur l'appareil, sous SERIES_THEMES_KEY (citée dans la politique de confidentialité), comme le meilleur
// score de la course (#287) et la cote à ta mesure (#284). Rien n'est envoyé au serveur.
import { THEME_DU_PROBLEME, type Theme } from '../content/themes';
import { choisirProbleme, cible, type EtatCote } from './coteJoueur';

export type SerieTheme = 'capturer' | 'sauver' | 'vie-mort' | 'relier-couper' | 'fin-de-partie' | 'tesuji';

/** Ordre d'affichage : du geste le plus simple aux combinaisons. */
export const SERIES_THEMES: readonly SerieTheme[] = ['capturer', 'sauver', 'vie-mort', 'relier-couper', 'fin-de-partie', 'tesuji'];

/** En dessous, la série n'est pas affichée : elle s'épuiserait en quelques problèmes. */
export const MIN_PAR_SERIE = 8;

/** Clé de stockage local : réussites d'affilée et record de chaque série. */
export const SERIES_THEMES_KEY = 'go.series-themes.v1';

/**
 * Thèmes de la banque regroupés par série. Le thème « atari » mêle deux gestes : sauver sa pierre en atari, ou mettre
 * en atari pour capturer. On les sépare d'après la position : la pierre marquée est la sienne (S quand Noir joue,
 * T quand Blanc joue), c'est un sauvetage. Le ko et l'ouverture n'entrent dans aucune série.
 */
const SERIE_DU_THEME: Partial<Record<Theme, SerieTheme>> = {
  capture: 'capturer',
  bord: 'capturer',
  'vie-mort': 'vie-mort',
  seki: 'vie-mort',
  semeai: 'vie-mort',
  'relier-couper': 'relier-couper',
  'fin-de-partie': 'fin-de-partie',
  comptage: 'fin-de-partie',
  'double-atari': 'tesuji',
  echelle: 'tesuji',
  filet: 'tesuji',
  'prise-en-retour': 'tesuji',
};

interface ProblemeTheme { id: string; difficulty: number; rows: readonly string[]; toPlay: 1 | 2 }

/** Le joueur a une pierre marquée : c'est elle qu'il faut sauver. */
const saPierreMarquee = (p: ProblemeTheme) => p.rows.some(r => r.includes(p.toPlay === 1 ? 'S' : 'T'));

/** Série d'un problème, ou undefined s'il n'entre dans aucune. */
export function serieDe(p: ProblemeTheme): SerieTheme | undefined {
  const theme = THEME_DU_PROBLEME[p.id];
  if (!theme) return undefined;
  if (theme === 'atari') return saPierreMarquee(p) ? 'sauver' : 'capturer';
  return SERIE_DU_THEME[theme];
}

/** Problèmes d'une série. `exclure` : le Go du jour, qui reste le même pour tous et ne se joue pas ailleurs. */
export function problemesDe<T extends ProblemeTheme>(liste: readonly T[], serie: SerieTheme, exclure?: string): T[] {
  return liste.filter(p => p.id !== exclure && serieDe(p) === serie);
}

/** Séries à afficher, dans l'ordre : seulement celles qui ont assez de problèmes. */
export function seriesDisponibles(liste: readonly ProblemeTheme[], exclure?: string): SerieTheme[] {
  const n = new Map<SerieTheme, number>();
  for (const p of liste) {
    if (p.id === exclure) continue;
    const s = serieDe(p);
    if (s) n.set(s, (n.get(s) ?? 0) + 1);
  }
  return SERIES_THEMES.filter(s => (n.get(s) ?? 0) >= MIN_PAR_SERIE);
}

/**
 * Prochain problème d'une série, à ta mesure : le même choix que « Continuer » (#284, environ 85 % de réussite
 * prévue), restreint à la série. Quand tout est réussi, la série continue avec le problème déjà vu le plus proche de
 * la difficulté visée (jamais `eviter`) : elle ne s'arrête pas.
 */
export function prochainDeSerie<T extends ProblemeTheme>(
  liste: readonly T[], serie: SerieTheme, etat: EtatCote,
  { reussis, goDuJour, jour, eviter, alea = Math.random }: {
    reussis: ReadonlySet<string>; goDuJour?: string; jour: number; eviter?: string; alea?: () => number;
  }
): T | undefined {
  const pool = problemesDe(liste, serie, goDuJour);
  const choisi = choisirProbleme(pool, etat, reussis, { jour, eviter, alea });
  if (choisi) return choisi;
  const reste = pool.filter(p => p.id !== eviter);
  if (!reste.length) return undefined;
  const c = cible(etat);
  const m = Math.min(...reste.map(p => Math.abs(p.difficulty - c)));
  const ex = reste.filter(p => Math.abs(p.difficulty - c) === m);
  return ex[Math.min(ex.length - 1, Math.floor(alea() * ex.length))];
}

export interface EtatSerieTheme {
  /** Problèmes réussis du premier coup d'affilée dans cette série. */
  affilee: number;
  /** Plus longue suite de réussites d'affilée. */
  record: number;
}
export type EtatSeriesThemes = Partial<Record<SerieTheme, EtatSerieTheme>>;

const entier = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.min(9999, Math.floor(x)) : 0);

/** État relu du stockage : série inconnue ou valeur abîmée, ignorée. */
export function nettoyerSeries(brut: unknown): EtatSeriesThemes {
  const out: EtatSeriesThemes = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return out;
  for (const s of SERIES_THEMES) {
    const e = (brut as Record<string, unknown>)[s];
    if (!e || typeof e !== 'object') continue;
    const affilee = entier((e as Record<string, unknown>).affilee);
    const record = Math.max(affilee, entier((e as Record<string, unknown>).record));
    out[s] = { affilee, record };
  }
  return out;
}

/**
 * Premier essai d'un problème de la série : réussi, une de plus d'affilée (et le record suit) ; raté, retour à 0.
 * `nouveauRecord` : le record vient d'être dépassé (jamais pour la toute première réussite, qui n'a rien à battre).
 */
export function noterSerie(etat: EtatSeriesThemes, serie: SerieTheme, reussi: boolean): { etat: EtatSeriesThemes; nouveauRecord: boolean } {
  const avant = etat[serie] ?? { affilee: 0, record: 0 };
  const affilee = reussi ? avant.affilee + 1 : 0;
  const record = Math.max(avant.record, affilee);
  return { etat: { ...etat, [serie]: { affilee, record } }, nouveauRecord: reussi && avant.record > 0 && affilee > avant.record };
}
