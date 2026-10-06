// Étude partagée (#449) : « Étudie-la avec Mochi » dépose ici la copie à ouvrir, l'écran d'étude (chargé à la demande)
// la reprend. Un simple casier en mémoire : rien sur le réseau, rien de gardé tant que l'écran d'étude ne l'a pas ouverte
// (il la garde alors sur l'appareil, comme toute étude). Module minuscule, sans dépendance : il entre dans le JS initial.

export interface CopieEtude {
  /** SGF minimal de l'étude (position en AB/AW, trait en PL, variante en coups). */
  sgf: string;
  /** Pseudo de qui l'a partagée (null : inconnu). */
  pseudo: string | null;
}

let casier: CopieEtude | null = null;

/** Dépose la copie à ouvrir dans l'écran d'étude. */
export function deposerCopieEtude(c: CopieEtude): void { casier = c; }

/** Copie en attente, sans la retirer (l'écran peut se monter deux fois en développement). */
export function copieEtudeEnAttente(): CopieEtude | null { return casier; }

/** La copie est ouverte : le casier se vide. */
export function oublierCopieEtude(): void { casier = null; }
