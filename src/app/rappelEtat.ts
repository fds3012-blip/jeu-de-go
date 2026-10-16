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
  /** Rappel allumé sur cet appareil. */
  actif: boolean;
  moment: MomentRappel;
}
export const ETAT_INITIAL: EtatRappel = { proposition: null, actif: false, moment: 'soir' };

/** Relit l'état en tolérant les valeurs abîmées. */
export function lireEtatRappel(brut: unknown): EtatRappel {
  if (typeof brut !== 'object' || brut === null) return ETAT_INITIAL;
  const b = brut as Partial<EtatRappel>;
  return {
    proposition: b.proposition === 'proposee' || b.proposition === 'refusee' || b.proposition === 'acceptee' ? b.proposition : null,
    actif: b.actif === true,
    moment: MOMENTS.includes(b.moment as MomentRappel) ? (b.moment as MomentRappel) : 'soir',
  };
}

/** L'adresse vient d'un rappel touché (`?rappel=1`) : lu une fois au chargement. */
export const estArriveeRappel = (search: string): boolean => new URLSearchParams(search).get('rappel') === '1';

function lire(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

export function etatRappel(): EtatRappel {
  try { return lireEtatRappel(JSON.parse(lire(RAPPEL_KEY) ?? 'null')); } catch { return ETAT_INITIAL; }
}
