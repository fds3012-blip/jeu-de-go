// Fenêtre de consentement (issue #50) : une seule question, au premier lancement, jamais pendant une partie.
import { useSyncExternalStore } from 'react';
import { getConsent, getOpposition, subscribeConsent, type Consent } from '../data/analytics';

/** Choix mémorisé du joueur, mis à jour dès qu'il change (fenêtre, interrupteur). */
export function useConsentement(): Consent | null {
  return useSyncExternalStore(subscribeConsent, getConsent, () => null);
}

/** Opposition à la mesure anonyme (page Conditions), mise à jour dès qu'elle change. */
export function useOpposition(): boolean {
  return useSyncExternalStore(subscribeConsent, getOpposition, () => false);
}

export interface EtatFenetre {
  /** Choix mémorisé (src/data/analytics.ts) : null tant que le joueur n'a pas répondu. */
  consent: Consent | null;
  /** Fenêtre fermée avec Échap pendant cette session : pas de choix, elle reviendra au prochain lancement. */
  ignoree: boolean;
  /** Partie en cours : la fenêtre attend le retour à l'accueil. */
  enPartie: boolean;
  /** Page « Conditions et confidentialité » ouverte : on la lit sans fenêtre par-dessus. */
  surConditions: boolean;
}

/** Vrai si la fenêtre de consentement doit être affichée. */
export function fenetreVisible(e: EtatFenetre): boolean {
  return e.consent === null && !e.ignoree && !e.enPartie && !e.surConditions;
}
