// Coach Mochi pendant les parties contre l'IA (#470), côté écran : quel moment dire, quand, et avec quelle phrase.
// Les détections viennent de src/go/coach.ts (règles seules, phrase vraie à coup sûr, sinon rien).
//
// Règles :
// - 3 bulles au plus par partie (BULLES_PAR_PARTIE) ;
// - au moins ECART_MIN demi-coups entre deux bulles : Mochi ne parle pas à chaque coup ;
// - un même groupe (ou le coin vide) n'est signalé qu'une fois ;
// - priorité : atari, puis un seul œil, puis prise ratée, puis grande zone libre ;
// - la bulle arrive après la réponse de l'IA, jamais pendant qu'elle réfléchit, et ne joue jamais à ta place.
import { toLabel } from '../go/coords';
import { atariNouveau, priseRatee, unSeulOeil, zoneLibre, type MomentCoach } from '../go/coach';
import type { Color, Position } from '../go/rules';
import { langue as langueCourante, traduire, type Langue } from '../content/i18n/secondaires';

export type { MomentCoach } from '../go/coach';

export const BULLES_PAR_PARTIE = 3;
/** Demi-coups au moins entre deux bulles (4 : deux de tes coups). */
export const ECART_MIN = 4;

/** Ce que le coach a déjà dit dans la partie. */
export interface EtatCoach { bulles: number; derniereA: number | null; deja: string[] }
export const etatCoachInitial = (): EtatCoach => ({ bulles: 0, derniereA: null, deja: [] });

/** Clé d'un moment : un même groupe (sa plus petite pierre) ou le coin vide ne revient pas. */
export function cleMoment(m: MomentCoach): string {
  switch (m.type) {
    case 'atari': case 'un-oeil': case 'prise-ratee': return `${m.type}:${Math.min(...m.pierres)}`;
    case 'zone-libre': return 'zone-libre';
  }
}

export interface EntreeCoach {
  /** Position avant ton dernier coup (toi au trait), `null` au tout début. */
  avantToi: Position | null;
  /** Position après ton dernier coup (l'IA au trait). */
  apresToi: Position;
  /** Position après la réponse de l'IA (toi au trait). */
  apresIa: Position;
  moi: Color;
  /** Longueur de l'historique une fois la réponse de l'IA jouée. */
  len: number;
}

/** Moment à dire maintenant, ou `null` (budget épuisé, trop tôt après la bulle d'avant, rien de sûr). */
export function choisirMoment(e: EntreeCoach, etat: EtatCoach): MomentCoach | null {
  if (etat.bulles >= BULLES_PAR_PARTIE) return null;
  if (etat.derniereA !== null && e.len - etat.derniereA < ECART_MIN) return null;
  if (e.apresIa.toPlay !== e.moi) return null;
  const neuf = (m: MomentCoach | null) => (m && !etat.deja.includes(cleMoment(m)) ? m : null);
  return neuf(atariNouveau(e.apresToi, e.apresIa, e.moi))
    ?? neuf(unSeulOeil(e.apresIa, e.moi))
    ?? (e.avantToi ? neuf(priseRatee(e.avantToi, e.apresToi, e.moi)) : null)
    ?? neuf(zoneLibre(e.apresIa));
}

/** Note le moment dit (budget, écart, groupe déjà signalé). */
export function noterMoment(etat: EtatCoach, m: MomentCoach, len: number): EtatCoach {
  return { bulles: etat.bulles + 1, derniereA: len, deja: [...etat.deja, cleMoment(m)] };
}

const COTE = { hd: 'conseil.cote.hd', hg: 'conseil.cote.hg', bd: 'conseil.cote.bd', bg: 'conseil.cote.bg' } as const;

/** Phrase de Mochi pour un moment, dans la langue demandée (par défaut celle de l'interface). */
export function phraseCoach(m: MomentCoach, size: number, l: Langue = langueCourante()): string {
  switch (m.type) {
    case 'atari': return traduire(l, 'coach.atari', { point: toLabel(m.repere, size) });
    case 'un-oeil': return traduire(l, 'coach.unOeil', { point: toLabel(m.repere, size) });
    case 'prise-ratee': return traduire(l, 'coach.priseRatee', { point: toLabel(m.point, size), n: m.pierres.length });
    case 'zone-libre': return traduire(l, 'coach.zoneLibre', { ou: traduire(l, COTE[m.coin]) });
  }
}

/** Ce que le calque montre sur le plateau (sans capter les touches) : la zone et le point cerclé. */
export function calqueCoach(m: MomentCoach, pos: Position): { zone: number[]; point: number | null } {
  const tri = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
  switch (m.type) {
    case 'atari': return { zone: tri([...m.pierres, m.liberte]), point: m.liberte };
    case 'un-oeil': return { zone: tri([...m.pierres, ...m.oeil]), point: null };
    // Les pierres ont pu bouger depuis (sauvées ou reliées) : seules celles encore là sont montrées.
    case 'prise-ratee': return { zone: tri([m.point, ...m.pierres.filter(p => pos.board[p] !== 0 && pos.board[p] !== pos.toPlay)]), point: m.point };
    case 'zone-libre': return { zone: m.zone, point: null };
  }
}

/** Propriétés de `coach_bulle` (jamais la position). */
export function proprietesBulle(m: MomentCoach, o: { numero: number; coup: number; taille: number; adversaire: string }) {
  return { type: m.type, numero: o.numero, coup: o.coup, taille: o.taille, adversaire: o.adversaire };
}
