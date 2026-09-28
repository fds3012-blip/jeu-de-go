// « Révision du jour » (issue #199) : 3 problèmes déjà réussis, repris par répétition espacée. Logique pure, sans React.
// Les jours sont les numéros du Go du jour (`numeroDuJour`) : comptés en heure de Paris, quel que soit le fuseau.
// Principe (base de connaissances, effet de test, Roediger et Karpicke 2006) : se tester sur ce qu'on a réussi
// le fait mieux retenir que relire. Pas de pierre qui « se fissure », pas de perte : seulement une proposition.
//
// Calendrier : un problème réussi le jour J revient à J+1, puis J+3, puis J+7 (écarts comptés depuis la réussite).
// Réussi du premier coup et sans aide : il passe à l'échéance suivante ; après J+7, il est acquis et ne revient plus.
// Sinon (essai faux ou aide) : on repart de ce jour, prochain passage à J+1. Jamais de punition, juste un rappel plus tôt.
//
// Redites (#237, N3) : un problème réussi en pratique de fin de leçon, ou un Go du jour qui reprend une étape de leçon,
// a déjà été vu deux fois ce jour-là. La révision du lendemain le saute (`recents`) : il revient au passage suivant.
//
// Étapes de leçon : pas encore (le lecteur de leçon ne sait pas ouvrir une étape seule). Voir la PR.

/** Échéances après la réussite : J+1, J+3, J+7. */
export const ECHEANCES = [1, 3, 7] as const;
/** Exercices proposés par jour. */
export const PAR_JOUR = 3;
export const REVISION_KEY = 'go.revision.v1';

export interface Suivi {
  /** Jour de référence : première réussite, ou dernier échec en révision. */
  base: number;
  /** Échéance à venir (0 : J+1, 1 : J+3, 2 : J+7) ; 3 : acquis, ne revient plus. */
  etape: number;
}

export interface Jour {
  numero: number;
  /** Les exercices choisis pour ce jour, dans l'ordre. */
  ids: string[];
  /** Ceux déjà faits aujourd'hui. */
  faits: string[];
}

export interface EtatRevision {
  suivis: Record<string, Suivi>;
  jour: Jour | null;
  /**
   * Redites (#237) : jour où le problème a été réussi hors révision alors qu'il répétait déjà une leçon
   * (pratique de fin de leçon, Go du jour identique à une étape). La révision ne le propose ni ce jour-là ni le lendemain.
   */
  recents?: Record<string, number>;
}

export const ETAT_VIDE: EtatRevision = { suivis: {}, jour: null };

/** Vrai si le problème a été vu en redite aujourd'hui ou hier (jour `numero`). */
export function vuRecemment(etat: EtatRevision, id: string, numero: number): boolean {
  const j = etat.recents?.[id];
  return j !== undefined && j >= numero - 1 && j <= numero;
}

/**
 * Note qu'un problème vient d'être réussi en redite le jour `numero` (pratique de fin de leçon, ou Go du jour
 * identique à une étape de leçon). Les notes de plus d'un jour sont oubliées.
 */
export function noterRedite(etat: EtatRevision, id: string, numero: number): EtatRevision {
  const recents: Record<string, number> = {};
  for (const [k, j] of Object.entries(etat.recents ?? {})) if (j >= numero - 1) recents[k] = j;
  recents[id] = numero;
  return { ...etat, recents };
}

/** Jour du prochain passage, ou null si l'exercice est acquis. */
export function prochain(s: Suivi): number | null {
  return s.etape >= ECHEANCES.length ? null : s.base + ECHEANCES[s.etape];
}

/**
 * Ajoute les problèmes réussis que la révision ne suit pas encore, avec pour base le jour `numero`.
 * Un problème réussi aujourd'hui ne revient donc que demain (à 5 minutes, relire vaut mieux que se tester).
 * Les problèmes réussis avant cette fonction entrent aussi, le jour où on les voit pour la première fois.
 */
export function synchroniser(etat: EtatRevision, reussis: Iterable<string>, numero: number): EtatRevision {
  let suivis = etat.suivis;
  for (const id of reussis) {
    if (suivis[id]) continue;
    if (suivis === etat.suivis) suivis = { ...etat.suivis };
    suivis[id] = { base: numero, etape: 0 };
  }
  return suivis === etat.suivis ? etat : { ...etat, suivis };
}

/**
 * Exercices dus le jour `numero`, les plus en retard d'abord (puis par id, pour un ordre stable).
 * Un problème vu en redite hier ou aujourd'hui (#237) attend : il sera dû, en retard, au jour suivant.
 */
export function dus(etat: EtatRevision, numero: number, disponibles?: ReadonlySet<string>): string[] {
  return Object.entries(etat.suivis)
    .filter(([id, s]) => {
      const p = prochain(s);
      return p !== null && p <= numero && (!disponibles || disponibles.has(id)) && !vuRecemment(etat, id, numero);
    })
    .sort(([a, sa], [b, sb]) => (prochain(sa)! - prochain(sb)!) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([id]) => id);
}

/**
 * Révision du jour `numero` : la sélection déjà faite aujourd'hui reste la même (on ne la retire pas en cours de journée) ;
 * sinon, les 3 exercices dus les plus en retard. Une sélection vide n'est pas gardée : elle se refait plus tard.
 */
export function revisionDuJour(etat: EtatRevision, numero: number, disponibles?: ReadonlySet<string>): EtatRevision {
  if (etat.jour?.numero === numero) return etat;
  const ids = dus(etat, numero, disponibles).slice(0, PAR_JOUR);
  if (!ids.length) return etat.jour ? { ...etat, jour: null } : etat;
  return { ...etat, jour: { numero, ids, faits: [] } };
}

/** Prochain exercice à faire aujourd'hui (aucun : la révision du jour est faite, ou il n'y en a pas). */
export function aFaire(etat: EtatRevision, numero: number): string | undefined {
  const j = etat.jour;
  if (!j || j.numero !== numero) return undefined;
  return j.ids.find(id => !j.faits.includes(id));
}

/** Vrai quand la révision du jour a été proposée et que tous ses exercices sont faits. */
export function revisionFaite(etat: EtatRevision, numero: number): boolean {
  const j = etat.jour;
  return !!j && j.numero === numero && j.ids.length > 0 && j.ids.every(id => j.faits.includes(id));
}

/**
 * Après un exercice de révision résolu le jour `numero`.
 * `reussi` : du premier coup et sans aide. L'exercice est marqué fait dans tous les cas (il a été résolu).
 */
export function apresRevision(etat: EtatRevision, id: string, reussi: boolean, numero: number): EtatRevision {
  const s = etat.suivis[id] ?? { base: numero, etape: 0 };
  const suivi: Suivi = reussi
    // En retard : l'échéance suivante ne tombe jamais aujourd'hui ni avant.
    ? avancer(s, numero)
    : { base: numero, etape: 0 };
  const j = etat.jour;
  const jour = j && j.numero === numero && j.ids.includes(id) && !j.faits.includes(id) ? { ...j, faits: [...j.faits, id] } : j;
  return { ...etat, suivis: { ...etat.suivis, [id]: suivi }, jour };
}

function avancer(s: Suivi, numero: number): Suivi {
  const etape = s.etape + 1;
  if (etape >= ECHEANCES.length) return { base: s.base, etape: ECHEANCES.length };
  // Si la révision a été faite en retard, on décale la base pour que la prochaine échéance tombe au plus tôt demain.
  const base = Math.max(s.base, numero + 1 - ECHEANCES[etape]);
  return { base, etape };
}

/** Relit l'état gardé sur l'appareil, en écartant ce qui est mal formé. */
export function lireRevision(brut: unknown): EtatRevision {
  if (!brut || typeof brut !== 'object') return ETAT_VIDE;
  const b = brut as { suivis?: unknown; jour?: unknown; recents?: unknown };
  const suivis: Record<string, Suivi> = {};
  if (b.suivis && typeof b.suivis === 'object') {
    for (const [id, s] of Object.entries(b.suivis as Record<string, unknown>)) {
      const v = s as Partial<Suivi> | null;
      if (v && Number.isInteger(v.base) && Number.isInteger(v.etape) && (v.etape as number) >= 0) {
        suivis[id] = { base: v.base as number, etape: Math.min(ECHEANCES.length, v.etape as number) };
      }
    }
  }
  const j = b.jour as Partial<Jour> | null | undefined;
  const jour = j && Number.isInteger(j.numero) && Array.isArray(j.ids) && Array.isArray(j.faits)
    ? { numero: j.numero as number, ids: j.ids.filter((x): x is string => typeof x === 'string'), faits: j.faits.filter((x): x is string => typeof x === 'string') }
    : null;
  const recents: Record<string, number> = {};
  if (b.recents && typeof b.recents === 'object') {
    for (const [id, j] of Object.entries(b.recents as Record<string, unknown>)) if (Number.isInteger(j)) recents[id] = j as number;
  }
  return Object.keys(recents).length ? { suivis, jour, recents } : { suivis, jour };
}
