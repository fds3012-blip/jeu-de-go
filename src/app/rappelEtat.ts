// Rappel quotidien du Go du jour (issue #36) : ce que l'accueil lit au chargement (#563). Le reste (proposition,
// abonnement, Profil) est dans src/app/rappel.ts, chargé avec ses écrans ; il réexporte ce module.

/** Choix du joueur sur cet appareil. Préférence d'interface ; l'abonnement lui-même est sur le serveur. */
export const RAPPEL_KEY = 'go.rappel.v1';

export type MomentRappel = 'matin' | 'midi' | 'soir';
export const MOMENTS: readonly MomentRappel[] = ['matin', 'midi', 'soir'];
/** Heure locale de chaque moment : la même que `heure_rappel` dans la migration abonnements_rappel. */
export const HEURES: Record<MomentRappel, number> = { matin: 9, midi: 12, soir: 18 };

export interface EtatRappel {
  /** La proposition de fin de partie : jamais montrée (null), montrée, refusée (définitif) ou acceptée. */
  proposition: 'proposee' | 'refusee' | 'acceptee' | null;
  /** Rappel du Go du jour allumé sur cet appareil. */
  actif: boolean;
  moment: MomentRappel;
  /** #699 : « À toi de jouer » (parties lentes) allumé sur cet appareil. Éteint tant que le joueur ne l'a pas demandé. */
  tours: boolean;
}
export const ETAT_INITIAL: EtatRappel = { proposition: null, actif: false, moment: 'soir', tours: false };

/** Relit l'état en tolérant les valeurs abîmées. */
export function lireEtatRappel(brut: unknown): EtatRappel {
  if (typeof brut !== 'object' || brut === null) return ETAT_INITIAL;
  const b = brut as Partial<EtatRappel>;
  return {
    proposition: b.proposition === 'proposee' || b.proposition === 'refusee' || b.proposition === 'acceptee' ? b.proposition : null,
    actif: b.actif === true,
    moment: MOMENTS.includes(b.moment as MomentRappel) ? (b.moment as MomentRappel) : 'soir',
    tours: b.tours === true,
  };
}

/** L'adresse vient d'un rappel touché (`?rappel=1`) : lu une fois au chargement. */
export const estArriveeRappel = (search: string): boolean => new URLSearchParams(search).get('rappel') === '1';

/**
 * #699 : la notification « à toi de jouer » touchée ouvre `/?tour=<identifiant de la partie>` (public/sw.js). Rend
 * l'identifiant (en minuscules) ou null. Seul un identifiant bien formé passe : jamais d'autre texte dans l'application.
 */
export function partieDeNotification(search: string): string | null {
  const v = new URLSearchParams(search).get('tour') ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v.toLowerCase() : null;
}

function lire(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

export function etatRappel(): EtatRappel {
  try { return lireEtatRappel(JSON.parse(lire(RAPPEL_KEY) ?? 'null')); } catch { return ETAT_INITIAL; }
}
