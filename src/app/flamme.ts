// La flamme dit l'état du jour ; Pomme accueille selon le jour (issue #213). Logique pure, sans React.
// Les jours sont les numéros du Go du jour (goDuJour.ts), donc comptés en heure de Paris.

/** Dernière visite de l'appareil : jour et absence constatée ce jour-là (gardée pour toute la journée). */
export const VISITE_KEY = 'go.visite.v1';

/** À partir de combien de jours sans venir Pomme parle d'un retour (deux jours pleins manqués). */
export const ABSENCE_MIN = 3;

export interface Visite { jour: number; absence: number }

/** Relit la visite venue du stockage local, en tolérant les valeurs abîmées. */
export function lireVisite(brut: unknown): Visite | null {
  const v = (brut ?? {}) as Partial<Visite>;
  if (!Number.isInteger(v.jour)) return null;
  return { jour: v.jour as number, absence: Number.isInteger(v.absence) && (v.absence as number) > 0 ? (v.absence as number) : 0 };
}

/**
 * Visite du jour `numero`. Le premier passage du jour mesure l'absence (jours depuis la visite précédente) ;
 * les passages suivants du même jour la gardent : la bulle ne change pas au rechargement.
 * Premier passage de l'appareil : absence 0 (ce n'est pas un retour).
 */
export function visiter(precedente: Visite | null, numero: number): Visite {
  if (!precedente) return { jour: numero, absence: 0 };
  if (precedente.jour === numero) return precedente;
  return { jour: numero, absence: Math.max(0, numero - precedente.jour) };
}

export const estRetour = (absence: number) => absence >= ABSENCE_MIN;

/**
 * État de la flamme de l'en-tête :
 * - `pleine` : le Go du jour d'aujourd'hui est fait ;
 * - `creuse` : une série est en jeu, mais le Go du jour d'aujourd'hui reste à faire ;
 * - null : pas de série, rien à montrer (jamais de flamme éteinte mise en avant).
 */
export type EtatFlamme = 'pleine' | 'creuse' | null;
export function etatFlamme(serie: number, faitAujourdhui: boolean): EtatFlamme {
  if (faitAujourdhui) return 'pleine';
  return serie > 0 ? 'creuse' : null;
}

/** Choix déterministe d'une réplique pour le jour `numero` : même jour, même réplique, sur tous les appareils. */
export function repliqueDuJour<T>(liste: readonly T[], numero: number): T {
  const n = liste.length;
  return liste[((Math.floor(numero) % n) + n) % n];
}
