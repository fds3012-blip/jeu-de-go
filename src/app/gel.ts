// Série protégée (issue #76), premier incrément côté appareil : le gel de série du Go du jour. Logique pure, sans React.
// Les jours sont les numéros du Go du jour (`numeroDuJour`), donc comptés en heure de Paris quel que soit le fuseau.
// La série elle-même reste celle de goDuJour.ts (même clé, même format) : le texte de partage ne change pas.
import { serieApres, type Serie } from './goDuJour';

/** Réserve de gels, gardée sur l'appareil à côté de la série. */
export const GEL_KEY = 'go.gel.v1';
/** Un gel gagné tous les 7 jours de série. */
export const JOURS_PAR_GEL = 7;
/** Au plus 2 gels en réserve. */
export const GELS_MAX = 2;

export interface Reserve {
  gels: number;
  /** Numéros des jours sauvés par un gel. */
  geles: number[];
  /** Série sauvée, à annoncer une seule fois par Mochi. */
  annonce: number | null;
}

export const RESERVE_VIDE: Reserve = { gels: 0, geles: [], annonce: null };

export interface Bilan {
  serie: Serie | null;
  reserve: Reserve;
  /** Jours gelés à l'instant (pour l'événement `gel_utilise`). */
  utilises: number[];
}

/**
 * À l'ouverture du jour `numero` : les jours manqués depuis la dernière réussite consomment un gel chacun.
 * - Assez de gels : ils sont consommés, les jours sont marqués gelés, et la série tient (on avance `dernier` à la veille).
 * - Pas assez : la série repart à zéro et les gels restent en réserve (on n'en brûle pas pour rien).
 * Aujourd'hui n'est jamais « manqué » : le joueur a jusqu'à minuit, heure de Paris.
 */
export function reconcilier(serie: Serie | null, reserve: Reserve, numero: number): Bilan {
  if (!serie) return { serie, reserve, utilises: [] };
  const manques = numero - serie.dernier - 1;
  if (manques <= 0) return { serie, reserve, utilises: [] };
  if (manques > reserve.gels) return { serie: { dernier: serie.dernier, jours: 0 }, reserve, utilises: [] };
  const utilises = Array.from({ length: manques }, (_, i) => serie.dernier + 1 + i);
  return {
    serie: { dernier: numero - 1, jours: serie.jours },
    reserve: { gels: reserve.gels - manques, geles: [...reserve.geles, ...utilises].slice(-30), annonce: serie.jours },
    utilises,
  };
}

/** Après la réussite du jour `numero` : la série de goDuJour.ts, plus un gel tous les 7 jours (plafond 2). */
export function apresReussite(serie: Serie | null, reserve: Reserve, numero: number): { serie: Serie; reserve: Reserve; gagne: boolean } {
  const s = serieApres(serie, numero);
  const nouveauJour = !serie || serie.dernier !== numero;
  const palier = nouveauJour && s.jours > 0 && s.jours % JOURS_PAR_GEL === 0;
  if (!palier || reserve.gels >= GELS_MAX) return { serie: s, reserve, gagne: false };
  return { serie: s, reserve: { ...reserve, gels: reserve.gels + 1 }, gagne: true };
}

/** Relit une réserve venue du stockage local, en tolérant les valeurs abîmées. */
export function lireReserve(brut: unknown): Reserve {
  const r = (brut ?? {}) as Partial<Reserve>;
  const gels = Number.isInteger(r.gels) ? Math.max(0, Math.min(GELS_MAX, r.gels as number)) : 0;
  const geles = Array.isArray(r.geles) ? r.geles.filter(n => Number.isInteger(n)) : [];
  const annonce = Number.isInteger(r.annonce) && (r.annonce as number) > 0 ? (r.annonce as number) : null;
  return { gels, geles, annonce };
}

/** Message de Mochi au retour, après un jour sauvé. */
export const messageGel = (jours: number) => `Ton gel a protégé ta série de ${jours} jour${jours > 1 ? 's' : ''} !`;

/** Nom accessible du glaçon. */
export const libelleGels = (n: number) => (n === 0 ? 'Aucun gel de série' : `${n} gel${n > 1 ? 's' : ''} de série en réserve`);
