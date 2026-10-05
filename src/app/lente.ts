// Parties lentes (issue #440) : logique pure de l'écran src/app/Lentes.tsx, sans React ni réseau.
import type { EtatDefi } from '../data/defi';
import { vueDefi, type Phase } from './defiAmi';

/** Une ligne de « Tes parties lentes ». */
export interface LigneLente {
  partieId: string;
  adversaireId: string | null;
  phase: Phase;
  /** C'est au joueur d'agir : jouer, ou répondre au comptage. */
  aMoi: boolean;
  /** Temps restant pour le coup en cours (ms), null hors délai. */
  restant: number | null;
  taille: number;
}

/** Parties finies gardées dans la liste (les plus récentes) : la liste reste courte. */
export const FINIES_MAX = 5;

/**
 * Lignes de la liste : d'abord celles où c'est à toi (la plus pressée en premier), puis celles où c'est à l'autre,
 * puis les dernières parties finies.
 */
export function lignesLentes(etats: readonly EtatDefi[], userId: string, maintenant = Date.now()): LigneLente[] {
  const lignes = etats.map(d => {
    const v = vueDefi(d.partie, d.defi, userId, maintenant, d.resultat);
    const aMoi = v.aMoi || (v.phase === 'comptage' && !v.proposeParMoi);
    const adversaireId = (v.couleur === 1 ? d.partie.white_id : d.partie.black_id) ?? null;
    return { partieId: d.partie.id, adversaireId, phase: v.phase, aMoi, restant: v.restant, taille: d.partie.size };
  });
  const rang = (l: LigneLente) => (l.phase === 'fini' ? 2 : l.aMoi ? 0 : 1);
  const enCours = lignes.filter(l => l.phase !== 'fini')
    .sort((a, b) => rang(a) - rang(b) || (a.restant ?? Infinity) - (b.restant ?? Infinity));
  return [...enCours, ...lignes.filter(l => l.phase === 'fini').slice(0, FINIES_MAX)];
}

/** Parties lentes en cours (pour la limite de 10, affichée avant que le serveur ne refuse). */
export const enCours = (lignes: readonly LigneLente[]): number => lignes.filter(l => l.phase !== 'fini').length;

/** Heures d'attente (arrondies au dixième) depuis le début de la recherche, pour la mesure. */
export function heuresDepuis(depuis: string, maintenant = Date.now()): number {
  const t = Date.parse(depuis);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.round((maintenant - t) / 360_000) / 10);
}
