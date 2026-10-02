// « Rejoue tes erreurs » (issue #77) : chaque Erreur ou Grosse erreur de la revue, avec un conseil fiable de KataGo,
// devient un problème gardé sur l'appareil (localStorage). Logique pure, testée dans erreurs.test.ts.
// Règle d'or : jamais de problème faux. Sans conseil fiable (conseilFiable), pas de problème.
import type { AnalyseRevue } from '../engine';
import type { Puzzle } from '../data/puzzles';
import type { Color, Position } from '../go/rules';
import { conseilFiable, VISITES_MIN, type Note } from './revue';
import { t } from '../content/i18n';
import { ECHEANCES } from './revision';

export const ERREURS_KEY = 'go.erreurs.v1';
/** Au plus 30 problèmes : les plus anciens sont remplacés en premier. */
export const MAX_ERREURS = 30;
/** Un coup est accepté s'il perd moins de 1 point par rapport au meilleur, selon KataGo (issue #77). */
export const MARGE_EQUIVALENT = 1;
/** Deux réussites en révision : l'erreur est maîtrisée et ne revient plus. */
export const REUSSITES_MAITRISE = 2;

export interface ErreurGardee {
  id: string;
  /** Date de création (ISO), pour remplacer les plus anciennes. */
  creeLe: string;
  /** Jour du prochain passage (AAAA-MM-JJ, heure locale). */
  prochain: string;
  /** Nombre d'échecs. */
  rates: number;
  /** Réussites en révision (absent dans les anciennes listes : 0). À 2, l'erreur est maîtrisée. */
  reussites?: number;
  size: 9 | 13 | 19;
  rows: string[];
  toPlay: Color;
  /** Coups acceptés (index internes) ; le premier est le meilleur coup de KataGo. */
  reponses: number[];
  /** Coup joué dans la partie (index interne, -1 : passe). */
  joue: number;
  coup: number;
  adversaire?: string;
}

/** Vrai si ce coup peut devenir un problème : Erreur ou Grosse erreur, avec un meilleur coup fiable. */
export function peutEnFaireUnProbleme(note: Note | null | undefined, meilleur: number | null | undefined): boolean {
  return (note === 'erreur' || note === 'manque' || note === 'grosse') && meilleur != null && meilleur >= 0;
}

/** Jour local au format AAAA-MM-JJ. */
export function jour(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Jour `n` jours après `d` (heure locale). */
export function dansJours(d: Date, n: number): string {
  return jour(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Lendemain du jour `d`. */
export function lendemain(d: Date): string {
  return dansJours(d, 1);
}

/** Rangées du plateau (X noir, O blanc, . vide), format des problèmes. */
export function rangees(pos: Position): string[] {
  const n = pos.size, out: string[] = [];
  for (let y = 0; y < n; y++) {
    let r = '';
    for (let x = 0; x < n; x++) { const c = pos.board[y * n + x]; r += c === 1 ? 'X' : c === 2 ? 'O' : '.'; }
    out.push(r);
  }
  return out;
}

/**
 * Coups que KataGo juge équivalents au meilleur (ils perdent moins de 1 point), tirés de l'analyse de la position avant l'erreur.
 * Seulement si le meilleur coup y figure avec assez de visites : sinon, on ne sait pas, et seul le meilleur est accepté.
 * Chaque équivalent passe aussi par conseilFiable (pas de première ligne sur un plateau ouvert, coup légal).
 * `perte` : points perdus par le coup joué.
 */
export function equivalents(avant: Position, meilleur: number, analyse: AnalyseRevue | null | undefined, joue: number, perte: number): number[] {
  if (!analyse || analyse.engine !== 'katago') return [];
  const coups = analyse.coups ?? [], premier = coups[0];
  if (!premier || premier.visits < VISITES_MIN) return [];
  const m = coups.find(c => c.move === meilleur);
  if (!m || m.visits < VISITES_MIN) return [];
  const ref = Math.max(premier.lead, m.lead);
  return coups
    .filter(c => c.move !== meilleur && c.move !== joue && c.move >= 0 && c.visits >= VISITES_MIN && ref - c.lead < MARGE_EQUIVALENT)
    .filter(c => conseilFiable(avant, c.move, perte - (ref - c.lead)))
    .map(c => c.move);
}

export interface Source {
  avant: Position;
  /** Coup joué (index, -1 : passe). */
  joue: number;
  coup: number;
  note: Note | null | undefined;
  /** Meilleur coup déjà validé par conseilFiable (`null` : pas de conseil fiable). */
  meilleur: number | null | undefined;
  perte: number;
  analyse?: AnalyseRevue | null;
  adversaire?: string;
}

/** Petit hachage stable, pour ne pas garder deux fois la même position. */
function hache(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Problème tiré d'une erreur, ou `null` si on ne peut pas en faire un problème juste. */
export function creerErreur(s: Source, maintenant: Date): ErreurGardee | null {
  const size = s.avant.size;
  if (size !== 9 && size !== 13 && size !== 19) return null;
  if (!peutEnFaireUnProbleme(s.note, s.meilleur)) return null;
  const meilleur = s.meilleur!;
  const rows = rangees(s.avant), toPlay = s.avant.toPlay;
  return {
    id: `erreur-${hache(`${rows.join('/')}|${toPlay}`)}`,
    creeLe: maintenant.toISOString(),
    prochain: jour(maintenant),
    rates: 0,
    size, rows, toPlay,
    reponses: [meilleur, ...equivalents(s.avant, meilleur, s.analyse, s.joue, s.perte)],
    joue: s.joue, coup: s.coup, adversaire: s.adversaire,
  };
}

/** Ajoute un problème : la même position remplace l'ancienne ; au-delà de 30, les plus anciennes partent. */
export function ajouter(liste: ErreurGardee[], e: ErreurGardee): ErreurGardee[] {
  const reste = liste.filter(x => x.id !== e.id);
  return [...reste, e].sort((a, b) => a.creeLe.localeCompare(b.creeLe)).slice(-MAX_ERREURS);
}

/** Problèmes à rejouer aujourd'hui (le prochain passage est passé ou tombe aujourd'hui). */
export function aRejouer(liste: ErreurGardee[], maintenant: Date): ErreurGardee[] {
  const j = jour(maintenant);
  return liste.filter(e => e.prochain <= j);
}

/** Vrai si le coup `p` est accepté pour cette erreur : le meilleur coup ou un coup qui perd moins de 1 point. */
export function coupAccepte(e: Pick<ErreurGardee, 'reponses'>, p: number): boolean {
  return p >= 0 && e.reponses.includes(p);
}

/**
 * Erreur ratée au premier essai dans la revue : elle rejoint la révision espacée et revient demain (J+1).
 * La même position déjà gardée repart aussi de J+1, sans perdre ses réussites.
 */
export function garderRatee(liste: ErreurGardee[], e: ErreurGardee, maintenant: Date): ErreurGardee[] {
  const ancienne = liste.find(x => x.id === e.id);
  return ajouter(liste, { ...e, prochain: dansJours(maintenant, ECHEANCES[0]), rates: (ancienne?.rates ?? 0) + 1, reussites: ancienne?.reussites ?? 0 });
}

/**
 * Après un essai en révision (même calendrier que la Révision du jour, revision.ts) :
 * - raté : elle revient le lendemain (J+1) ;
 * - réussi : elle revient plus tard, J+3 après la 1re réussite, J+7 après la 2e ;
 *   à REUSSITES_MAITRISE réussites, elle est maîtrisée et sort de la liste.
 */
export function apresEssai(liste: ErreurGardee[], id: string, reussi: boolean, maintenant: Date): ErreurGardee[] {
  return liste.flatMap(e => {
    if (e.id !== id) return [e];
    if (!reussi) return [{ ...e, prochain: dansJours(maintenant, ECHEANCES[0]), rates: e.rates + 1 }];
    const reussites = (e.reussites ?? 0) + 1;
    if (reussites >= REUSSITES_MAITRISE) return [];
    return [{ ...e, reussites, prochain: dansJours(maintenant, ECHEANCES[Math.min(reussites, ECHEANCES.length - 1)]) }];
  });
}

/** Vrai si cet essai réussi rend l'erreur maîtrisée (elle quitte alors la liste). */
export function devientMaitrisee(e: Pick<ErreurGardee, 'reussites'>, reussi: boolean): boolean {
  return reussi && (e.reussites ?? 0) + 1 >= REUSSITES_MAITRISE;
}

/** Titre du problème : « Ta partie contre Pomme, coup 14 ». */
export function titreErreur(e: Pick<ErreurGardee, 'coup' | 'adversaire'>): string {
  return e.adversaire ? t('erreurs.titreContre', { adversaire: e.adversaire, coup: e.coup }) : t('erreurs.titreDeux', { coup: e.coup });
}

/** Consigne : avec des coups équivalents, « trouve mieux » ; sinon, on dit que seul le coup de KataGo compte. */
export function consigneErreur(e: Pick<ErreurGardee, 'reponses'>): string {
  return t(e.reponses.length > 1 ? 'erreurs.consigneMieux' : 'erreurs.consigneKataGo');
}

/** Problème pour le lecteur existant. */
export function versProbleme(e: ErreurGardee): Puzzle {
  return {
    id: e.id, size: e.size, rows: e.rows, toPlay: e.toPlay, answers: e.reponses, line: [e.reponses[0]],
    title: titreErreur(e), prompt: consigneErreur(e),
    explanation: t(e.reponses.length > 1 ? 'erreurs.bravoParmi' : 'erreurs.bravoKataGo'),
    refutation: t('erreurs.refutation'),
    difficulty: 600,
  };
}

/** Relit la liste gardée, en écartant ce qui est mal formé. */
export function lireErreurs(brut: unknown): ErreurGardee[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter((e): e is ErreurGardee => !!e && typeof e === 'object'
    && typeof e.id === 'string' && typeof e.prochain === 'string' && typeof e.creeLe === 'string'
    && (e.size === 9 || e.size === 13 || e.size === 19) && Array.isArray(e.rows) && e.rows.length === e.size
    && (e.toPlay === 1 || e.toPlay === 2) && Array.isArray(e.reponses) && e.reponses.length > 0
    && e.reponses.every((p: unknown) => typeof p === 'number' && p >= 0 && p < e.size * e.size));
}
