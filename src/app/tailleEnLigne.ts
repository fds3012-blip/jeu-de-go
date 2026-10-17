// #613 : la taille du plateau d'une partie en ligne (en direct ou lente) se choisit au lancement, et le dernier choix
// est déjà coché la fois suivante. Sans choix, la file par défaut (9 × 9, #436) : la plus fréquentée. La taille de
// l'ordi (Réglages, feuille de lancement) ne s'en mêle pas.
export type TailleEnLigne = 9 | 13 | 19;

export const TAILLE_EN_LIGNE_KEY = 'go.enligne.taille.v1';

/** Dernière taille choisie pour une partie en ligne, ou null (jamais choisie, stockage illisible). */
export function lireTailleEnLigne(): TailleEnLigne | null {
  try {
    const v = Number(localStorage.getItem(TAILLE_EN_LIGNE_KEY));
    return v === 9 || v === 13 || v === 19 ? v : null;
  } catch { return null; }
}

export function ecrireTailleEnLigne(t: TailleEnLigne): void {
  try { localStorage.setItem(TAILLE_EN_LIGNE_KEY, String(t)); } catch { /* stockage bloqué : la file par défaut reviendra */ }
}
