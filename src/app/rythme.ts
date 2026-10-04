// Rythme de la partie contre l'ordi (#187) : délai de réponse « humain » et phrases qui accompagnent la réponse.
import type { Raison } from '../engine';
import { t } from '../content/i18n/secondaires';

/**
 * Pomme « respire » : sa réponse arrive après un délai variable plutôt qu'en 350 ms fixes.
 * Drapeau pour revenir à l'ancien comportement (et base d'un futur A/B).
 */
export const POMME_RESPIRE = true;
/** Ancien délai minimum de réponse de l'ordi, en millisecondes (avant #187). */
export const DELAI_FIXE = 350;
/** Délai de réponse de l'ordi, en millisecondes : tiré entre `min` et `max`. */
export const DELAI_REPONSE = { min: 500, max: 1200 } as const;
/** Réponse forcée (l'ordi est en atari) : le délai reste dans le premier tiers de la fourchette. */
export const PART_FORCEE = 0.3;
/** Après une capture du joueur, l'ordi attend en plus : le temps de lire « Bravo, tu captures… ». */
export const BONUS_CAPTURE = 700;
/** Tests de bout en bout (build VITE_E2E) : réponse rapide pour ne pas ralentir les parcours. */
export const DELAI_E2E = 60;

export interface OptionsDelai {
  /** Tirage entre 0 et 1 (Math.random en jeu, fixé dans les tests). */
  hasard: number;
  /** Le joueur vient de capturer : on lui laisse le temps de savourer. */
  capture?: boolean;
  /** Réponse forcée : l'ordi doit sauver un groupe en atari. */
  forcee?: boolean;
  /** `false` : ancien délai fixe de 350 ms. */
  respire?: boolean;
  /** Build de test : délai court. */
  e2e?: boolean;
}

/** Durée minimale, en millisecondes, entre la pierre du joueur et la réponse de l'ordi. */
export function delaiReponse({ hasard, capture = false, forcee = false, respire = POMME_RESPIRE, e2e = false }: OptionsDelai): number {
  const bonus = capture ? BONUS_CAPTURE : 0;
  if (e2e) return DELAI_E2E + bonus;
  if (!respire) return DELAI_FIXE + bonus;
  const h = Math.min(1, Math.max(0, hasard));
  const etendue = (DELAI_REPONSE.max - DELAI_REPONSE.min) * (forcee ? PART_FORCEE : 1);
  return Math.round(DELAI_REPONSE.min + h * etendue) + bonus;
}

/** Phrase de Mochi quand l'ordi joue au lieu de passer après ta passe (#185, #187). */
export function messageContinue(nom: string, raison: Pick<Raison, 'cle' | 'params'>): string {
  return t('partie.continue', { nom, raison: t(raison.cle, raison.params) });
}
