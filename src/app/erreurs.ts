// « Rejoue tes erreurs » (issue #77) : chaque Erreur ou Grosse erreur de la revue, avec un conseil fiable de KataGo,
// devient un problème gardé sur l'appareil (localStorage). Logique pure, testée dans erreurs.test.ts.
// Règle d'or : jamais de problème faux. Sans conseil fiable (conseilFiable), pas de problème.
import type { AnalyseRevue } from '../engine';
import type { Puzzle, PourquoiProbleme } from '../data/puzzles';
import { fromRows } from '../go/position';
import { cadresPourquoi, confirmationPourquoi, textePourquoi, type Contexte } from './pourquoi';
import type { Color, Position } from '../go/rules';
import { conseilFiable, VISITES_MIN, type Note } from './revue';
import { t } from '../content/i18n/secondaires';
import { ACQUIS, ERREURS_KEY, apresEchec, apresEssai as essaiSuivi, dansJours, jour, type Suivi } from './revisionEspacee';

export { dansJours, jour };

// La clé vit dans revisionEspacee.ts (#469) : l'accueil compte les erreurs dues sans charger ce module.
export { ERREURS_KEY };
/** Au plus 30 problèmes : les plus anciens sont remplacés en premier. */
export const MAX_ERREURS = 30;
/** Un coup est accepté s'il perd moins de 1 point par rapport au meilleur, selon KataGo (issue #77). */
export const MARGE_EQUIVALENT = 1;
/**
 * Révision espacée (#469, src/app/revisionEspacee.ts) : J+1, J+3, J+7, J+14, J+30. Réussie à J+30 (5e réussite
 * d'affilée), l'erreur est maîtrisée et ne revient plus.
 */
export const REUSSITES_MAITRISE = ACQUIS;

export interface ErreurGardee {
  id: string;
  /** Date de création (ISO), pour remplacer les plus anciennes. */
  creeLe: string;
  /** Jour du prochain passage (AAAA-MM-JJ, heure locale). */
  prochain: string;
  /** Nombre d'échecs. */
  rates: number;
  /** Réussites d'affilée en révision : la marche atteinte (absent dans les anciennes listes : 0). À 5, l'erreur est maîtrisée. */
  reussites?: number;
  /** Date du dernier changement (ms) : avec un compte, le plus récent gagne entre deux appareils (#469). */
  maj?: number;
  size: 9 | 13 | 19;
  rows: string[];
  toPlay: Color;
  /** Coups acceptés (index internes) ; le premier est le meilleur coup de KataGo. */
  reponses: number[];
  /** Coup joué dans la partie (index interne, -1 : passe). */
  joue: number;
  coup: number;
  adversaire?: string;
  /** Points perdus par le coup joué, selon KataGo (#492 : « environ 6 points »). Absent dans les anciennes listes. */
  perte?: number;
}

/** Vrai si ce coup peut devenir un problème : Erreur ou Grosse erreur, avec un meilleur coup fiable. */
export function peutEnFaireUnProbleme(note: Note | null | undefined, meilleur: number | null | undefined): boolean {
  return (note === 'erreur' || note === 'manque' || note === 'grosse') && meilleur != null && meilleur >= 0;
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
    ...(Number.isFinite(s.perte) && s.perte > 0 ? { perte: Math.round(s.perte * 10) / 10 } : {}),
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

/** Place de l'erreur dans le calendrier de la révision espacée (#469). */
export function suiviErreur(e: Pick<ErreurGardee, 'prochain' | 'reussites' | 'rates' | 'maj' | 'creeLe'>): Suivi {
  return { etape: Math.min(ACQUIS - 1, e.reussites ?? 0), prochain: e.prochain, echecs: e.rates, maj: e.maj ?? (Date.parse(e.creeLe) || 0) };
}

/**
 * Erreur ratée au premier essai (revue, « Rejouer mes erreurs ») : elle entre dans la révision espacée et revient
 * demain (J+1). La même position déjà gardée repart aussi de J+1, au pied de l'échelle (#469 : un échec renvoie à J+1).
 */
export function garderRatee(liste: ErreurGardee[], e: ErreurGardee, maintenant: Date): ErreurGardee[] {
  const ancienne = liste.find(x => x.id === e.id);
  const s = apresEchec({ echecs: ancienne?.rates ?? 0 }, maintenant);
  return ajouter(liste, { ...e, prochain: s.prochain!, rates: s.echecs, reussites: 0, maj: s.maj });
}

/**
 * Après un essai en révision (#469, src/app/revisionEspacee.ts) :
 * - raté : elle revient le lendemain (J+1), au pied de l'échelle ;
 * - réussi : elle monte d'une marche, J+3, puis J+7, J+14, J+30 ;
 *   réussie à J+30 (REUSSITES_MAITRISE réussites d'affilée), elle est maîtrisée et sort de la liste.
 */
export function apresEssai(liste: ErreurGardee[], id: string, reussi: boolean, maintenant: Date): ErreurGardee[] {
  return liste.flatMap(e => {
    if (e.id !== id) return [e];
    const s = essaiSuivi(suiviErreur(e), reussi, maintenant);
    if (s.prochain === null) return [];
    return [{ ...e, prochain: s.prochain, reussites: s.etape, rates: s.echecs, maj: s.maj }];
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

/**
 * Pourquoi la réponse est la bonne (#492) : explication vérifiée par le calcul (src/app/pourquoi.ts), montrée avec la
 * réponse ; courte confirmation après une réussite, pour chaque coup accepté ; suite illustrée et croix sur le coup joué.
 */
export function pourquoiErreur(e: ErreurGardee): PourquoiProbleme {
  const ctx: Contexte = { avant: fromRows(e.rows, e.toPlay).pos, bon: e.reponses[0], joue: e.joue, perte: e.perte };
  const base = t(e.reponses.length > 1 ? 'erreurs.bravoParmi' : 'erreurs.bravoKataGo');
  const bravos: Record<number, string> = {};
  for (const p of e.reponses) {
    const pourquoi = confirmationPourquoi(ctx, p);
    bravos[p] = pourquoi ? `${base} ${pourquoi}` : base;
  }
  return { ...textePourquoi(ctx), bravos, joue: e.joue, cadres: () => cadresPourquoi(ctx) };
}

/** Problème pour le lecteur existant. */
export function versProbleme(e: ErreurGardee): Puzzle {
  return {
    id: e.id, size: e.size, rows: e.rows, toPlay: e.toPlay, answers: e.reponses, line: [e.reponses[0]],
    title: titreErreur(e), prompt: consigneErreur(e),
    explanation: t(e.reponses.length > 1 ? 'erreurs.bravoParmi' : 'erreurs.bravoKataGo'),
    refutation: t('erreurs.refutation'),
    difficulty: 600,
    pourquoi: pourquoiErreur(e),
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
