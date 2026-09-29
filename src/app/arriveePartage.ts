// Arrivée par un lien partagé du Go du jour (issue #285). Logique pure, sans React.
// L'ami qui touche le lien n'a souvent jamais joué au go : après le problème, une seule action le mène à la leçon 1.
import type { Langue } from '../content/i18n';

/**
 * Vrai si une valeur gardée sur l'appareil ne montre aucune activité : absente, objet vide,
 * ou objet dont toutes les valeurs sont nulles (`{ n: 0 }` des parties, `{ l1: 0 }` d'une leçon ouverte sans étape faite).
 */
export function sansActivite(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every(x => x === null || x === undefined || x === 0 || x === false);
}

/**
 * Joueur qui n'a jamais joué sur cet appareil : aucune partie, aucune leçon, aucun problème, pas de série ni de placement.
 * `valeurs` : ce que l'appareil garde pour chacune de ces clés, lu au chargement (avant le premier coup).
 */
export function jamaisJoue(valeurs: readonly unknown[]): boolean {
  return valeurs.every(sansActivite);
}

/** Numéro du Go du jour réellement ouvert par le lien : un numéro passé ouvre ce jour-là, sinon celui d'aujourd'hui. */
export function numeroOuvert(demande: number, jour: number): number {
  return demande >= 1 && demande < jour ? demande : jour;
}

/** Propriétés de `arrivee_par_partage` : `numero` ouvert, `lang` de l'interface et `nouveau_joueur`. */
export function proprietesArrivee(demande: number, jour: number, lang: Langue, nouveau: boolean) {
  return { numero: numeroOuvert(demande, jour), numero_demande: demande, numero_du_jour: jour, lang, nouveau_joueur: nouveau };
}
