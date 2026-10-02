// Défi par lien (issue #81) : logique pure des écrans (src/app/Defis.tsx), sans React ni réseau.
// À ne pas confondre avec src/app/defi.ts (« un défi par jour », règle interne de la série).
import { recordFromOnlineGame, parseDead } from '../go/server';
import { replay } from '../go/replay';
import { newPosition, type Position } from '../go/rules';
import { tempsRestant } from '../data/defi';
import type { Game } from '../data/games';
import type { Defi } from '../data/defi';
import { t } from '../content/i18n';

// Lecture du jeton dans l'adresse : src/data/defi.ts (#367 : importée au chargement sans tirer ce module, ses règles
// et son rejeu, qui ne servent qu'aux écrans du défi et à « À faire », chargés à la demande).
export { jetonDeLAdresse } from '../data/defi';

export type Raison = 'temps' | 'abandon' | 'points' | 'egalite';

export interface Issue {
  /** Vrai si le joueur a gagné, faux s'il a perdu ; null à l'égalité. */
  gagne: boolean | null;
  raison: Raison;
  /** Écart en points (fin aux points). */
  marge?: number;
}

/** Lit un résultat SGF (`B+3.5`, `W+T`, `B+R`, `0`) du point de vue de `couleur` (1 noir, 2 blanc). */
export function lireResultat(resultat: string | null, couleur: 1 | 2 | null): Issue | null {
  if (!resultat) return null;
  if (resultat === '0' || /^draw$/i.test(resultat)) return { gagne: null, raison: 'egalite' };
  const m = /^([BW])\+(T|R|Time|Resign|[\d.]+)$/i.exec(resultat);
  if (!m) return null;
  const vainqueur = m[1].toUpperCase() === 'B' ? 1 : 2;
  const suite = m[2].toUpperCase();
  const raison: Raison = suite.startsWith('T') ? 'temps' : suite.startsWith('R') ? 'abandon' : 'points';
  return { gagne: couleur === null ? null : couleur === vainqueur, raison, ...(raison === 'points' ? { marge: Number(m[2]) } : {}) };
}

export type Phase = 'attente' | 'jeu' | 'comptage' | 'fini';

export interface VueDefi {
  phase: Phase;
  /** Couleur du joueur (1 noir, 2 blanc), null s'il ne joue pas dans cette partie. */
  couleur: 1 | 2 | null;
  /** Position après les coups joués. */
  pos: Position;
  /** Couleur au trait. */
  trait: 1 | 2;
  /** Vrai si c'est au joueur de jouer (phase `jeu`). */
  aMoi: boolean;
  /** Temps restant pour le coup en cours (ms), null hors délai. */
  restant: number | null;
  /** Nombre de coups (passes comprises) joués par ce joueur : l'inscription est proposée après le premier. */
  mesCoups: number;
  /** Pierres mortes proposées au comptage (index), et qui les a proposées. */
  mortes: number[];
  proposeParMoi: boolean;
  proposeParAutre: boolean;
  issue: Issue | null;
}

/** Tout ce que l'écran de partie affiche, à partir des lignes `games` et `defis`. */
export function vueDefi(partie: Game, defi: Defi, userId: string | undefined, maintenant = Date.now(), resultat: string | null = partie.result): VueDefi {
  const couleur: 1 | 2 | null = userId && partie.black_id === userId ? 1 : userId && partie.white_id === userId ? 2 : null;
  const record = recordFromOnlineGame({ size: partie.size, komi: Number(partie.komi), rules: partie.rules === 'chinese' ? 'chinese' : 'japanese', handicap: partie.handicap, moves: partie.moves });
  const r = record ? replay(record, { superko: record.rules === 'chinese' }) : null;
  const pos = r && r.ok ? r.pos : newPosition(partie.size);
  const trait = pos.toPlay;
  const fini = partie.status === 'finished' || partie.status === 'aborted' || !!resultat;
  const phase: Phase = fini ? 'fini' : partie.status === 'waiting' ? 'attente' : partie.counting ? 'comptage' : 'jeu';
  const mesCoups = couleur === null || !record ? 0 : record.moves.filter(m => m.color === couleur).length;
  const mortes = (partie.dead_stones && parseDead(partie.dead_stones, partie.size)) || [];
  return {
    phase, couleur, pos, trait,
    aMoi: phase === 'jeu' && couleur === trait,
    restant: phase === 'jeu' ? tempsRestant(defi.date_limite, maintenant) : null,
    mesCoups,
    mortes,
    proposeParMoi: phase === 'comptage' && !!partie.dead_proposed_by && partie.dead_proposed_by === userId,
    proposeParAutre: phase === 'comptage' && !!partie.dead_proposed_by && partie.dead_proposed_by !== userId,
    issue: fini ? lireResultat(resultat, couleur) : null,
  };
}

const HEURE = 3_600_000, JOUR = 24 * HEURE;

/** Temps restant en mots : « 2 jours et 5 h », « 5 h », « moins d'une heure ». */
export function texteDelai(ms: number): string {
  if (ms < HEURE) return t('defi.delai.moinsUneHeure');
  const jours = Math.floor(ms / JOUR);
  const heures = Math.floor((ms % JOUR) / HEURE);
  if (!jours) return t('defi.delai.heures', { n: heures });
  if (!heures) return t('defi.delai.jours', { n: jours });
  return t('defi.delai.joursHeures', { jours: t('defi.delai.jours', { n: jours }), heures: t('defi.delai.heures', { n: heures }) });
}

/** Phrase d'état sous le plateau : à qui de jouer, et combien de temps il reste. `nom` : pseudo de l'ami, s'il est connu (#393). */
export function phraseEtat(v: VueDefi, nom?: string | null): string {
  if (v.phase === 'attente') return t('defi.etat.attente');
  if (v.phase === 'comptage') {
    if (v.proposeParAutre) return nom ? t('defi.etat.comptageAccepterNom', { nom }) : t('defi.etat.comptageAccepter');
    if (v.proposeParMoi) return nom ? t('defi.etat.comptageAttenteNom', { nom }) : t('defi.etat.comptageAttente');
    return t('defi.etat.comptage');
  }
  if (v.phase === 'fini') return phraseIssue(v.issue);
  const delai = v.restant === null ? '' : texteDelai(v.restant);
  if (v.aMoi) return t('defi.etat.aToi', { delai });
  return nom ? t('defi.etat.aLuiNom', { nom, delai }) : t('defi.etat.aLui', { delai });
}

/** Phrase de fin, du point de vue du joueur. */
export function phraseIssue(issue: Issue | null): string {
  if (!issue) return t('defi.fin.terminee');
  if (issue.gagne === null) return issue.raison === 'egalite' ? t('defi.fin.egalite') : t('defi.fin.terminee');
  const cle = issue.gagne ? 'gagne' : 'perdu';
  if (issue.raison === 'points') return t(issue.gagne ? 'defi.fin.gagne.points' : 'defi.fin.perdu.points', { marge: String(issue.marge ?? 0).replace('.', ',') });
  return t(`defi.fin.${cle}.${issue.raison === 'temps' ? 'temps' : 'abandon'}`);
}

/** Résumé d'une ligne de la liste « Tes défis ». */
export function resumeDefi(v: VueDefi): { etat: string; aMoi: boolean } {
  if (v.phase === 'attente') return { etat: t('defi.liste.attente'), aMoi: false };
  if (v.phase === 'fini') return { etat: phraseIssue(v.issue), aMoi: false };
  if (v.phase === 'comptage') return { etat: t('defi.liste.comptage'), aMoi: !v.proposeParMoi };
  return { etat: v.aMoi ? t('defi.liste.aToi', { delai: v.restant === null ? '' : texteDelai(v.restant) }) : t('defi.liste.aLui'), aMoi: v.aMoi };
}

/** Défis où c'est au joueur d'agir (jouer, ou répondre au comptage). */
export const aJouer = (vues: VueDefi[]): number => vues.filter(v => resumeDefi(v).aMoi).length;
