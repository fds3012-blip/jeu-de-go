// Réglages avancés d'une partie contre l'ordi ou à deux (#528, reprend #361 et #15) : handicap, komi, règle de comptage.
// Repliés dans la feuille « Changer » : tant que le joueur ne les ouvre pas, ils valent REGLAGES_DEFAUT, et la partie
// suit l'équilibrage des premières parties (src/app/equilibrage.ts) sans aucun changement.
// Module léger : lu par l'accueil (JS initial), sans texte ni dépendance lourde.
import type { Rules } from '../go/score';

/** Clé de l'appareil : réglages choisis dans « Réglages de la partie » (écrite seulement quand le joueur en change un). */
export const REGLAGES_PARTIE_KEY = 'go.partie.reglages.v1';

/** Vrai une fois que Mochi a expliqué le mot « handicap » au début d'une partie (on ne l'explique qu'une fois). */
export const HANDICAP_EXPLIQUE_KEY = 'go.handicap-explique.v1';

/** Handicaps proposés : sans handicap, puis 2 à 9 pierres (une pierre seule n'est pas un handicap posé). */
export const HANDICAPS = [0, 2, 3, 4, 5, 6, 7, 8, 9] as const;
/** Komis proposés en plus de « Auto » (celui de l'équilibrage) : 0,5 (avec handicap), 6,5 (japonais), 7,5 (chinois). */
export const KOMIS = [0.5, 6.5, 7.5] as const;
/** Komi imposé avec un handicap : la demie évite l'égalité, Noir a déjà son avance en pierres. */
export const KOMI_HANDICAP = 0.5;

export type ChoixKomi = 'auto' | (typeof KOMIS)[number];

export interface ReglagesPartie {
  /** 0 (sans handicap) ou 2 à 9 pierres noires posées d'avance ; Blanc joue alors en premier. */
  handicap: number;
  /** `auto` : le komi de l'équilibrage (0,5 pour les 3 premières parties contre l'ordi, puis 6,5). */
  komi: ChoixKomi;
  regles: Rules;
}

export const REGLAGES_DEFAUT: ReglagesPartie = { handicap: 0, komi: 'auto', regles: 'japanese' };

/** Réglages lus du stockage, valeurs abîmées remplacées par celles par défaut. */
export function lireReglagesPartie(brut: unknown): ReglagesPartie {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
  const handicap = (HANDICAPS as readonly unknown[]).includes(o.handicap) ? (o.handicap as number) : 0;
  const komi = o.komi === 'auto' || (KOMIS as readonly unknown[]).includes(o.komi) ? (o.komi as ChoixKomi) : 'auto';
  const regles: Rules = o.regles === 'chinese' ? 'chinese' : 'japanese';
  return { handicap, komi, regles };
}

/** Vrai tant que rien n'a été changé : la partie est exactement celle d'avant #528. */
export function estDefaut(r: ReglagesPartie): boolean {
  return r.handicap === 0 && r.komi === 'auto' && r.regles === 'japanese';
}

/** Komi compté dans la partie : 0,5 imposé avec un handicap ; `auto` : `komiEquilibrage`. */
export function komiDeLaPartie(r: ReglagesPartie, komiEquilibrage: number): number {
  if (r.handicap >= 2) return KOMI_HANDICAP;
  return r.komi === 'auto' ? komiEquilibrage : r.komi;
}

/** Handicap suivant ou précédent (bouton + ou −) : 0 ↔ 2, puis de 1 en 1 jusqu'à 9. */
export function handicapVoisin(h: number, sens: 1 | -1): number {
  const i = HANDICAPS.indexOf(h as (typeof HANDICAPS)[number]);
  const j = Math.min(HANDICAPS.length - 1, Math.max(0, (i < 0 ? 0 : i) + sens));
  return HANDICAPS[j];
}
