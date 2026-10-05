// Partie en direct (issue #360) : logique pure de l'écran src/app/Direct.tsx, sans React ni réseau.
import { recordFromOnlineGame, parseDead } from '../go/server';
import { replay } from '../go/replay';
import { newPosition, type Position } from '../go/rules';
import { ABSENCE_MS, CADENCE_DEFAUT, cadran, CADENCES, traitDe, type Cadence, type Cadran, type EtatDirect } from '../go/pendule';
import { lireResultat, type Issue } from './defiAmi';
import type { Game } from '../data/games';
import type { Regles, Taille } from '../data/direct';
import { td } from '../content/i18n/direct';
import { COTE_REGLES, coteDuGrade } from '../go/cote';

export type PhaseDirect = 'jeu' | 'comptage' | 'fini' | 'annulee';

export interface VueDirect {
  phase: PhaseDirect;
  /** Couleur du joueur (1 Noir, 2 Blanc), null s'il ne joue pas dans cette partie. */
  couleur: 1 | 2 | null;
  pos: Position;
  trait: 1 | 2;
  aMoi: boolean;
  mesCoups: number;
  mortes: number[];
  proposeParMoi: boolean;
  proposeParAutre: boolean;
  issue: Issue | null;
  /** Cadrans de Noir et de Blanc à l'heure du serveur. */
  cadrans: { 1: Cadran; 2: Cadran };
  /** Adversaire sans signe de présence depuis plus de 15 s alors que c'est à lui d'agir : secondes avant la fin de sa tolérance. */
  absenceLui: number | null;
}

/** On le dit à partir de 15 s sans nouvelles (le battement est de 10 s) ; le serveur tranche à 60 s. */
export const ABSENCE_VISIBLE_MS = 15_000;

/** Tout ce que l'écran affiche, à partir de la ligne `games` et de l'état de la pendule. */
export function vueDirect(partie: Game, etat: EtatDirect, userId: string | undefined, maintenantServeur: number): VueDirect {
  const couleur: 1 | 2 | null = userId && partie.black_id === userId ? 1 : userId && partie.white_id === userId ? 2 : null;
  const rules = partie.rules === 'chinese' ? 'chinese' : 'japanese';
  const record = recordFromOnlineGame({ size: partie.size, komi: Number(partie.komi), rules, handicap: partie.handicap, moves: etat.coups });
  const r = record ? replay(record, { superko: rules === 'chinese' }) : null;
  const pos = r && r.ok ? r.pos : newPosition(partie.size);
  const trait = traitDe(etat.coups);
  const phase: PhaseDirect = etat.statut === 'aborted' ? 'annulee' : etat.statut !== 'active' || etat.resultat ? 'fini' : etat.comptage ? 'comptage' : 'jeu';
  const mortes = (etat.mortes && parseDead(etat.mortes, partie.size)) || [];
  const lui = couleur ? (3 - couleur) as 1 | 2 : null;
  const presenceLui = lui === 1 ? etat.noir.vuLe : lui === 2 ? etat.blanc.vuLe : null;
  // Qui doit agir : le joueur au trait pendant le jeu ; les deux pendant le comptage.
  const doitAgir = phase === 'comptage' || (phase === 'jeu' && lui === trait);
  const depuis = Math.max(presenceLui ?? 0, phase === 'jeu' ? etat.traitDepuis ?? 0 : 0);
  const silence = depuis ? maintenantServeur - depuis : 0;
  return {
    phase, couleur, pos, trait,
    aMoi: phase === 'jeu' && couleur === trait,
    mesCoups: couleur === null || !record ? 0 : record.moves.filter(m => m.color === couleur).length,
    mortes,
    proposeParMoi: phase === 'comptage' && !!etat.mortesPar && etat.mortesPar === userId,
    proposeParAutre: phase === 'comptage' && !!etat.mortesPar && etat.mortesPar !== userId,
    issue: phase === 'fini' ? lireResultat(etat.resultat, couleur) : null,
    cadrans: { 1: cadran(etat, 1, maintenantServeur), 2: cadran(etat, 2, maintenantServeur) },
    absenceLui: doitAgir && lui && silence > ABSENCE_VISIBLE_MS ? Math.max(0, Math.ceil((ABSENCE_MS - silence) / 1000)) : null,
  };
}

/** Phrase de Mochi pendant la partie. `nom` : pseudo de l'adversaire. */
export function phraseDirect(v: VueDirect, nom: string, enLigne: boolean): string {
  if (!enLigne && (v.phase === 'jeu' || v.phase === 'comptage')) return td('direct.etat.horsLigne');
  if (v.absenceLui !== null) return td('direct.etat.absent', { nom, s: v.absenceLui });
  if (v.phase === 'comptage') {
    if (v.proposeParAutre) return td('direct.etat.comptageAccepter', { nom });
    if (v.proposeParMoi) return td('direct.etat.comptageAttente', { nom });
    return td('direct.etat.comptage');
  }
  if (v.phase === 'fini' || v.phase === 'annulee') return phraseFinDirect(v, nom);
  if (!v.aMoi) return td('direct.etat.aLui', { nom });
  if (v.couleur === 1 && v.mesCoups === 0) return td('direct.etat.bienvenue', { nom });
  const c = v.couleur ? v.cadrans[v.couleur] : null;
  return c?.byoyomi ? td('direct.etat.byoyomi', { s: Math.max(0, Math.ceil(c.ms / 1000)) }) : td('direct.etat.aToi');
}

/** Phrase de fin, du point de vue du joueur. */
export function phraseFinDirect(v: Pick<VueDirect, 'phase' | 'issue'>, nom: string): string {
  if (v.phase === 'annulee') return td('direct.fin.annulee');
  const i = v.issue;
  if (!i) return td('direct.fin.terminee');
  if (i.gagne === null) return i.raison === 'egalite' ? td('direct.fin.egalite') : td('direct.fin.terminee');
  const marge = String(i.marge ?? 0).replace('.', ',');
  if (i.raison === 'points') return i.gagne ? td('direct.fin.gagne.points', { marge }) : td('direct.fin.perdu.points', { nom, marge });
  if (i.raison === 'temps') return td(i.gagne ? 'direct.fin.gagne.temps' : 'direct.fin.perdu.temps');
  return i.gagne ? td('direct.fin.gagne.abandon', { nom }) : td('direct.fin.perdu.abandon');
}

/** « 10 min + 3 × 30 s ». */
export function texteCadence(c: Cadence): string {
  const r = CADENCES[c];
  return td('direct.cadence.detail', { min: r.mainMs / 60_000, n: r.periodes, s: r.periodeMs / 1000 });
}

/** Issue d'une partie terminée pour la mesure : `victoire`, `defaite`, `egalite`, `annulee`. */
export function issueMesure(v: Pick<VueDirect, 'phase' | 'issue'>): 'victoire' | 'defaite' | 'egalite' | 'annulee' | null {
  if (v.phase === 'annulee') return 'annulee';
  if (v.phase !== 'fini' || !v.issue) return null;
  return v.issue.gagne === null ? 'egalite' : v.issue.gagne ? 'victoire' : 'defaite';
}

// ---------- File jamais vide (#436) ----------

/** Réglages demandés dans la file : taille, temps de jeu, comptage. */
export interface Params { taille: Taille; cadence: Cadence; regles: Regles }
/** File par défaut (#436) : 9 × 9, 10 min + 3 × 30 s, comptage japonais. Tout le monde y attend d'abord. */
export const PARAMS_DEFAUT: Params = { taille: 9, cadence: CADENCE_DEFAUT, regles: 'japanese' };

/** Au bout de 25 s d'attente, Mochi propose de jouer contre l'IA en restant dans la file. */
export const REPLI_MS = 25_000;

/** Cote d'un adversaire de l'échelle d'après son rang affiché : « 10 kyu » → 2000, « 1 dan » → 3000 (#417). */
export function coteDuRang(rang: string): number | null {
  const m = /^(\d+)\s*(kyu|dan)$/i.exec(rang.trim());
  if (!m) return null;
  return coteDuGrade({ sorte: m[2].toLowerCase() === 'dan' ? 'dan' : 'kyu', n: Number(m[1]) });
}

/**
 * Adversaire IA du repli : celui de l'échelle dont le rang est le plus proche de la cote du joueur (à égalité, le plus
 * faible). Sans cote connue, celle d'un joueur qui connaît les règles (800). Toujours un adversaire IA nommé comme tel.
 */
export function adversaireDuRepli<T extends { rang: string }>(adversaires: readonly T[], cote: number | null | undefined): T {
  const c = typeof cote === 'number' && Number.isFinite(cote) ? cote : COTE_REGLES;
  let meilleur = adversaires[0];
  let ecart = Infinity;
  for (const a of adversaires) {
    const r = coteDuRang(a.rang);
    if (r === null) continue;
    const e = Math.abs(r - c);
    if (e < ecart) { ecart = e; meilleur = a; }
  }
  return meilleur;
}

/** Proposer le repli : assez attendu, en ligne, et pas déjà répondu pendant cette attente. */
export function proposerRepli(attenteMs: number, enLigne: boolean, repondu: boolean): boolean {
  return enLigne && !repondu && attenteMs >= REPLI_MS;
}
