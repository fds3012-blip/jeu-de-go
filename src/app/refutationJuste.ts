// Issue #693 : le texte d'erreur d'un problème ne doit parler que du coup que le joueur vient de jouer.
//
// `setup.refutation` est un texte fixe, écrit pour une erreur précise (« En C4, tu prends une pierre, mais Blanc joue F1… »,
// « Tu sauves G2, mais Blanc joue D4… »). Montré après n'importe quel mauvais coup, il décrit un coup qui n'a pas été joué.
// Règle d'or : aucune phrase fausse. Ici, le texte fixe n'est gardé que dans deux cas, vérifiés sur le plateau :
// 1. il ne commence pas par un coup précis (il vaut pour toute erreur), ou son coup précis est bien celui qui a été joué ;
// 2. la réplique qu'il nomme pour ce coup est celle que le lecteur exact prouve (sinon il annonce une autre réponse).
// Sinon `null` : l'écran montre la phrase calculée par les règles (src/app/comprendreErreur.ts), ou une phrase neutre.
import { groupAt, play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { startOf, type Puzzle } from '../data/puzzles';
import type { ErreurComprise } from './comprendreErreur';

const POINT = '[A-HJ-T](?:1[0-9]|[1-9])';
const UN_POINT = new RegExp(`\\b${POINT}\\b`, 'g');
/** « En C4, », « Après E1, », « En C4 ou D4, » : le coup joué est dit en tête de phrase. */
const EN_POINT = new RegExp(`^(?:En|Après) (${POINT}(?: ou ${POINT})*)\\s*,`);
/** « Tu prends B8, », « Si tu t'allonges en E9, », « Si tu joues A1 ou C1, » : un verbe, puis le ou les points. */
const TU_VERBE = /^(?:Si tu|Tu) (t['’]allonges|joues|mets|prends|sauves|captures|entres|relies|remplis|poses|ajoutes)\b([^,:]*)[,:]/;
const VERBES_CIBLE = new Set(['prends', 'captures']);
const VERBES_SAUVER = new Set(['sauves', 'relies']);

const point = (l: string, size: number): number => { try { return fromLabel(l, size); } catch { return -1; } };
const points = (s: string, size: number): number[] => (s.match(UN_POINT) ?? []).map(l => point(l, size)).filter(p => p >= 0);

/**
 * Le coup `faux` est-il celui que décrit la phrase `s` ? `undefined` quand la phrase ne décrit pas un coup joué
 * (« Blanc joue D4 : … », « Ailleurs, … »).
 * - « En X, … » et « Si tu joues X… » : X est le point joué ;
 * - « Tu prends X » : X est une pierre adverse, et le coup est celui qui la prend ; « Tu sauves X » : X est ta pierre,
 *   et le coup est celui qui la sort d'atari. Lu sur le plateau, pas sur le nom du point.
 */
function decrit(s: string, depart: Position, faux: number): boolean | undefined {
  const en = EN_POINT.exec(s);
  if (en) return points(en[1], depart.size).includes(faux);
  const tu = TU_VERBE.exec(s);
  if (!tu) return undefined;
  const clause = tu[2], verbe = tu[1].replace('’', "'");
  const joues = [...clause.matchAll(new RegExp(`\\ben (${POINT}(?: ou ${POINT})*)`, 'g'))].flatMap(m => points(m[1], depart.size));
  if (joues.length) return joues.includes(faux);
  const cites = points(clause, depart.size);
  if (!cites.length) return undefined;
  const apres = play(depart, faux);
  if (typeof apres === 'string') return false;
  return cites.some(c => {
    const avant = depart.board[c];
    if (!avant) return c === faux;
    if (VERBES_CIBLE.has(verbe)) return avant !== depart.toPlay && apres.board[c] === 0;
    if (VERBES_SAUVER.has(verbe)) return avant === depart.toPlay && apres.board[c] === avant && groupAt(apres.board, apres.size, c).liberties.size >= 2;
    return false;
  });
}

/** Phrases du texte, sans l'entrée (« Pas tout à fait. », « Pas encore. », « Pas celle-là. »). */
const phrases = (texte: string) => texte.replace(/^Pas [^.]{1,24}\.\s*/, '').split(/(?<=\.)\s+/).filter(Boolean);

/**
 * Le texte fixe du problème parle-t-il du coup `faux` ? Vrai s'il ne commence pas par un coup précis ; sinon vrai si
 * `faux` est un des coups que décrivent ses phrases (« Si tu joues A1 ou C1, … Si tu joues D1, … »).
 */
export function texteVautPour(pz: Puzzle, faux: number): boolean {
  const fr = pz.refutationFr ?? pz.refutation;
  if (!fr) return false;
  const { pos } = startOf(pz);
  const ph = phrases(fr);
  if (!ph.length || decrit(ph[0], pos, faux) === undefined) return true;
  return ph.some(s => decrit(s, pos, faux) === true);
}

/** La réplique annoncée par le texte est-elle « il n'a même pas besoin de répondre » ? */
export const SANS_REPONSE = -2;

/**
 * Réplique de l'adversaire que le texte annonce après `faux` : « Blanc joue D4 », « Blanc s'allonge en F5, ou en E6 si
 * tu as joué F5 ». `null` quand le texte n'en nomme pas une seule (rien à vérifier), `SANS_REPONSE` quand il dit que
 * Blanc n'a pas besoin de répondre. Lu sur le texte français.
 */
export function repliqueAnnoncee(fr: string, adv: string, faux: number, size: number): number | null {
  const seul = (l: string) => point(l, size);
  for (const m of fr.matchAll(new RegExp(`\\bsi tu as jou[ée] (${POINT}(?: ou ${POINT})*)\\b[^.]*n['’]a même pas besoin de répondre`, 'gi'))) {
    if (points(m[1], size).includes(faux)) return SANS_REPONSE;
  }
  for (const m of fr.matchAll(new RegExp(`\\bou (?:en )?(${POINT}) si tu as jou[ée] (${POINT}(?: ou ${POINT})*)\\b`, 'g'))) {
    if (points(m[2], size).includes(faux)) return seul(m[1]);
  }
  const base = new Set<number>();
  for (const m of fr.matchAll(new RegExp(`\\b${adv} (?:joue|s['’]allonge en|rejoue en|répond en|se relie en) (${POINT})\\b`, 'g'))) base.add(seul(m[1]));
  return base.size === 1 ? [...base][0] : null;
}

const NOM: Record<number, string> = { 1: 'Noir', 2: 'Blanc' };

/**
 * Texte fixe d'un problème à montrer après le coup faux `faux`, ou `null` : il parle d'un autre coup, ou il annonce une
 * réplique de l'adversaire autre que celle que le lecteur exact prouve (`comprise`).
 */
export function refutationPour(pz: Puzzle, faux: number, comprise: ErreurComprise | null): string | null {
  if (!pz.refutation || !texteVautPour(pz, faux)) return null;
  if (comprise) {
    const annoncee = repliqueAnnoncee(pz.refutationFr ?? pz.refutation, NOM[comprise.apresFaux.toPlay], faux, pz.size);
    if (annoncee !== null && annoncee !== comprise.reponse) return null;
  }
  return pz.refutation;
}
