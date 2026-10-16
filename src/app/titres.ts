// Titres mensuels (#561) : logique pure côté app. Le serveur calcule tout (supabase/migrations/20261016150000_titres_mensuels.sql,
// tâche pg_cron du 1er du mois) : joueurs actifs, seuils sur la distribution réelle, garde-fou des 200 actifs. L'app ne
// fait que lire SES titres (RLS) et décider quoi montrer : le titre du mois dernier (Profil) et la fête, une seule fois
// par titre sur l'appareil. Aucun seuil n'est recalculé ici. Doc : docs/game-design/titres-mensuels.md.

/** Du plus haut au plus bas. */
export const TITRES = ['maitre', 'expert', 'habitue'] as const;
export type Titre = (typeof TITRES)[number];

/** Part des joueurs actifs du mois qui reçoit au moins ce titre (rappel des coupures du serveur, pour les textes). */
export const POURCENT: Record<Titre, number> = { maitre: 1, expert: 5, habitue: 20 };

/** Un titre gagné : le mois (1er du mois, `AAAA-MM-01`, mois civil de Paris) et le titre. */
export interface TitreDuMois { mois: string; titre: Titre }

/** Dernier mois dont le titre a été fêté sur cet appareil (`AAAA-MM-01`). Rien d'autre. */
export const TITRE_FETE_KEY = 'go.titre-fete.v1';

const MOIS = /^\d{4}-(0[1-9]|1[0-2])-01$/;

/** Lignes de `titres_joueurs` (mois, titre), tolérantes : une ligne mal formée est ignorée. Du plus récent au plus ancien. */
export function lireTitres(brut: unknown): TitreDuMois[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((l): l is { mois: string; titre: Titre } => !!l && typeof l === 'object'
      && typeof (l as { mois?: unknown }).mois === 'string' && MOIS.test((l as { mois: string }).mois)
      && (TITRES as readonly unknown[]).includes((l as { titre?: unknown }).titre))
    .map(l => ({ mois: l.mois, titre: l.titre }))
    .sort((a, b) => (a.mois < b.mois ? 1 : a.mois > b.mois ? -1 : 0));
}

/** Mois civil de Paris qui précède celui de `maintenant`, en `AAAA-MM-01` (celui que le serveur vient de classer). */
export function moisPrecedent(maintenant: number = Date.now()): string {
  const parties = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date(maintenant));
  const an = Number(parties.find(p => p.type === 'year')?.value);
  const mois = Number(parties.find(p => p.type === 'month')?.value);
  const [a, m] = mois === 1 ? [an - 1, 12] : [an, mois - 1];
  return `${a}-${String(m).padStart(2, '0')}-01`;
}

/** Le titre du mois dernier, ou null (pas de titre, ou mois sous le garde-fou : le serveur n'a rien écrit). */
export function titreDuMoisDernier(titres: readonly TitreDuMois[], maintenant: number = Date.now()): TitreDuMois | null {
  const vise = moisPrecedent(maintenant);
  return titres.find(t => t.mois === vise) ?? null;
}

/** Relit le dernier mois fêté ; null si absent ou abîmé. */
export function lireMoisFete(brut: unknown): string | null {
  return typeof brut === 'string' && MOIS.test(brut) ? brut : null;
}

/** Faut-il fêter ce titre ? Oui une seule fois : seulement s'il est plus récent que le dernier fêté sur l'appareil. */
export function aFeter(titre: TitreDuMois | null, dejaFete: string | null): boolean {
  return !!titre && (dejaFete === null || titre.mois > dejaFete);
}
