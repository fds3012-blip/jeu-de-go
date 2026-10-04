// « Rejouer mes erreurs » (#428), sur le modèle du « Retry » de chess.com : dans le bilan, chaque erreur du joueur
// (Gaffe, Erreur, Coup manqué), de la plus grave à la moins grave, revient comme un petit problème. Logique pure,
// testée dans rejouerErreurs.test.ts (avec la vraie partie de l'issue #424, analysée par KataGo).
//
// Règle d'or, inchangée : aucune note fausse. Un essai est « bon » seulement si la mesure de KataGo le dit :
// - c'est son premier choix ;
// - ou un de ses candidats, bien exploré (au moins VISITES_MIN visites), qui perd au plus le seuil « Bon » : le coup
//   serait noté Excellent ou Bon, jamais Imprécision ;
// - sinon (coup que la recherche n'a pas exploré), une recherche courte compare la position après ton coup et la
//   position après le premier choix, avec le même nombre de visites ; même seuil. Sans KataGo, on ne juge pas.
import { isLegal, type Color, type Position } from '../go/rules';
import { toLabel } from '../go/coords';
import { t } from '../content/i18n/secondaires';
import { conseilFiable, facteurTaille, seuilsKataGo, VISITES_MIN, type AnalyseRevue, type Note, type NoteCoup } from './revue';

/** Notes qui se rejouent, de la plus grave à la moins grave (Coup manqué et Erreur se départagent par la perte). */
export type NoteARejouer = 'grosse' | 'erreur' | 'manque';
const RANG: Record<NoteARejouer, number> = { grosse: 0, erreur: 1, manque: 1 };
const A_REJOUER = (n: Note): n is NoteARejouer => n in RANG;

/**
 * Au plus 3 erreurs par séance : une séance courte, qu'on finit (un débutant fait souvent 15 Gaffes par partie,
 * comme dans la partie de l'issue #424). Les plus graves passent en premier.
 */
export const MAX_ERREURS_REJOUEES = 3;
/** Trois essais par erreur : après deux « Pas encore », le troisième raté fait montrer le coup de KataGo. */
export const ESSAIS = 3;
/** Visites de la recherche courte qui juge un coup hors des candidats : celles de l'analyse de la revue. */
export const VISITES_JUGE = 32;
/**
 * Au-delà de cette avance (ramenée au 9 × 9), la partie est jouée : une erreur qui laisse le joueur aussi loin devant
 * (ou derrière) ne change pas l'issue. On ne la rejoue pas : chercher mieux quand on mène de 50 points n'apprend rien.
 * Même seuil que le Brillant (revue.ts, notation.ts).
 */
export const PARTIE_JOUEE = 15;

export interface ErreurARejouer {
  /** Numéro du coup fautif (1 = premier coup) : on rejoue depuis la position `coup - 1`. */
  coup: number;
  note: NoteARejouer;
  /** Points perdus par le coup joué (ceux de la note). */
  perte: number;
  couleur: Color;
  /** Coup joué (index interne, -1 : passe). */
  joue: number;
  /** Premier choix de KataGo dans la position d'avant (index interne, jamais une passe). */
  meilleur: number;
}

/**
 * Erreurs à rejouer : tes Gaffes, Erreurs et Coups manqués (les deux camps si `joueur` est `null`), triés de la plus
 * grave à la moins grave (Gaffe d'abord, puis la plus grosse perte), au plus `max`. Seulement avec KataGo :
 * la position d'avant doit avoir une analyse KataGo dont le premier choix est bien exploré, légal, et montrable
 * à un débutant (conseilFiable : pas de première ligne sur un plateau encore ouvert). Écartées : les erreurs qui ne
 * changent pas l'issue (le joueur reste au-delà de 15 points d'avance, ou de retard, avec ou sans elle).
 */
export function erreursARejouer(
  positions: Position[], analyses: (AnalyseRevue | null)[], notes: (NoteCoup | null)[], joueur: Color | null, max = MAX_ERREURS_REJOUEES,
): ErreurARejouer[] {
  const out: (ErreurARejouer & { rang: number })[] = [];
  for (const n of notes) {
    if (!n || !A_REJOUER(n.note) || (joueur && n.couleur !== joueur)) continue;
    const avant = positions[n.coup - 1], apres = positions[n.coup], a = analyses[n.coup - 1];
    if (!avant || !apres || !a || a.engine !== 'katago') continue;
    const premier = a.coups?.[0], joue = apres.lastMove ?? -1;
    if (!premier || premier.visits < VISITES_MIN || premier.move < 0 || premier.move === joue || !isLegal(avant, premier.move)) continue;
    if (!conseilFiable(avant, premier.move, n.perte)) continue;
    const jouee = PARTIE_JOUEE * facteurTaille(avant.size), avecJoue = premier.lead - n.perte;
    if (Math.min(premier.lead, avecJoue) >= jouee || Math.max(premier.lead, avecJoue) <= -jouee) continue;
    out.push({ coup: n.coup, note: n.note, perte: n.perte, couleur: n.couleur, joue, meilleur: premier.move, rang: RANG[n.note] });
  }
  return out
    .sort((x, y) => x.rang - y.rang || y.perte - x.perte || x.coup - y.coup)
    .slice(0, max)
    .map(({ rang: _rang, ...e }) => e);
}

/** Jugement d'un essai. `perte` : points perdus face au premier choix de KataGo ; `gain` : points repris sur le coup joué. */
export type Jugement =
  | { verdict: 'bon'; perte: number; gain: number; premierChoix: boolean }
  | { verdict: 'faux'; perte: number }
  | { verdict: 'inconnu' };

const bon = (e: ErreurARejouer, perte: number, premierChoix: boolean): Jugement => ({ verdict: 'bon', perte, gain: Math.max(0, e.perte - perte), premierChoix });

/**
 * Jugement d'un essai `p` avec l'analyse déjà faite de la position d'avant. `null` : la recherche n'a pas assez
 * exploré ce coup pour le juger, il faut une recherche courte (`jugerParRecherche`).
 */
export function jugerEssai(e: ErreurARejouer, analyse: AnalyseRevue | null | undefined, p: number, size: number): Jugement | null {
  if (p === e.meilleur) return bon(e, 0, true);
  if (p === e.joue) return { verdict: 'faux', perte: e.perte };
  if (!analyse || analyse.engine !== 'katago') return { verdict: 'inconnu' };
  const coups = analyse.coups ?? [], premier = coups[0], c = coups.find(x => x.move === p);
  if (!premier || !c || c.visits < VISITES_MIN) return null;
  const perte = Math.max(0, premier.lead - c.lead);
  return perte <= seuilsKataGo(size).bon ? bon(e, perte, false) : { verdict: 'faux', perte };
}

/**
 * Jugement par recherche courte (même nombre de visites des deux côtés) : `apresMeilleur`, analyse de la position
 * après le premier choix de KataGo ; `apresEssai`, après ton coup. Avances de Noir : on les ramène au joueur.
 * Sans deux analyses KataGo, on ne juge pas (`inconnu`).
 */
export function jugerParRecherche(e: ErreurARejouer, apresMeilleur: AnalyseRevue | null | undefined, apresEssai: AnalyseRevue | null | undefined, size: number): Jugement {
  if (!apresMeilleur || !apresEssai || apresMeilleur.engine !== 'katago' || apresEssai.engine !== 'katago') return { verdict: 'inconnu' };
  const s = e.couleur === 1 ? 1 : -1, perte = Math.max(0, s * (apresMeilleur.lead - apresEssai.lead));
  return perte <= seuilsKataGo(size).bon ? bon(e, perte, false) : { verdict: 'faux', perte };
}

/** Résultat d'une erreur rejouée. */
export interface ResultatRejeu { coup: number; note: NoteARejouer; trouvee: boolean; essais: number }

/** Erreurs trouvées sur le total : « 2 sur 3 ». */
export function score(resultats: ResultatRejeu[]): { trouvees: number; total: number } {
  return { trouvees: resultats.filter(r => r.trouvee).length, total: resultats.length };
}

/** Consigne de Mochi : « Ici, tu as joué B8. Trouve mieux. » (partie à deux : « Ici, Noir a joué B8. »). */
export function consigne(e: ErreurARejouer, size: number, toi: boolean): string {
  const camp = t(e.couleur === 1 ? 'camp.noir' : 'camp.blanc');
  if (e.joue < 0) return toi ? t('rejeu.consignePasseToi') : t('rejeu.consignePasse', { camp });
  const lieu = toLabel(e.joue, size);
  return toi ? t('rejeu.consigneToi', { lieu }) : t('rejeu.consigne', { camp, lieu });
}

/** Points lisibles : « 11 points » (au moins 1). */
const pts = (n: number) => t('revue.points', { n: Math.max(1, Math.round(n)) });

/** Phrase de Mochi après un bon essai : le coup de KataGo, ou un coup aussi bon, et ce qu'il reprend sur le coup joué. */
export function phraseTrouve(j: Extract<Jugement, { verdict: 'bon' }>, e: ErreurARejouer, size: number): string {
  const debut = t(j.premierChoix ? 'rejeu.bravoKataGo' : 'rejeu.bravoParmi');
  if (j.gain < 1) return debut;
  const lieu = e.joue < 0 ? t('rejeu.taPasse') : toLabel(e.joue, size);
  return `${debut} ${t('rejeu.gain', { pts: pts(j.gain), lieu })}`;
}

/** Phrase après un essai raté : « Pas encore. », puis les essais qui restent. */
export function phrasePasEncore(essais: number): string {
  const reste = ESSAIS - essais;
  return `${t('rejeu.pasEncore')} ${reste <= 1 ? t('rejeu.dernierEssai') : t('rejeu.essaisRestants', { n: reste })}`;
}

/** Phrase quand Mochi montre le coup : « Voici le coup de KataGo : F5. Il valait 11 points de plus que B8. » */
export function phraseMontre(e: ErreurARejouer, size: number): string {
  const point = toLabel(e.meilleur, size), lieu = e.joue < 0 ? t('rejeu.taPasse') : toLabel(e.joue, size);
  return `${t('rejeu.voici', { point })} ${t('rejeu.valait', { pts: pts(e.perte), lieu })}`;
}

/** Titre de l'écran de fin : « 2 sur 3 trouvées ». */
export function titreFin(s: { trouvees: number; total: number }): string {
  return t('rejeu.finTitre', { n: s.trouvees, total: s.total });
}

/** Phrase de fin : toujours sur ce que le joueur emporte, jamais sur ce qu'il a raté (peak-end). */
export function phraseFin(s: { trouvees: number; total: number }): string {
  if (s.total > 0 && s.trouvees === s.total) return t('rejeu.finToutes');
  if (s.trouvees > 0) return t('rejeu.finCertaines');
  return t('rejeu.finAucune', { n: s.total });
}

// ---------- XP : une fois par partie ----------
// Rejouer ses erreurs est un effort réel (comme un problème) : 10 XP à la fin de la séance, une seule fois par partie
// (sinon, rejouer la même revue en boucle rapporterait sans fin, voir « Rejouer d'ici », economie.md C6).

export const XP_REJEU_KEY = 'go.revue.rejeuXp.v1';
/** Au plus 100 parties gardées : les plus anciennes sortent en premier. */
export const MAX_PARTIES_XP = 100;

/** Identifiant stable d'une partie (hachage de son SGF). */
export function idPartie(sgf: string): string {
  let h = 5381;
  for (let i = 0; i < sgf.length; i++) h = ((h * 33) ^ sgf.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Liste gardée des parties qui ont déjà rapporté leur XP, en écartant ce qui est mal formé. */
export function lireParties(brut: unknown): string[] {
  return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : [];
}

/** Ajoute la partie `id` si elle n'a pas encore rapporté d'XP. `null` : déjà comptée, pas d'XP. */
export function marquerPartie(liste: string[], id: string): string[] | null {
  if (liste.includes(id)) return null;
  return [...liste, id].slice(-MAX_PARTIES_XP);
}
