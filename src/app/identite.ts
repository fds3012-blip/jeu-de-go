// Carte d'identité du Profil (issue #50) : initiale, pseudo, cote et série, en une ligne.

export interface Identite {
  /** Initiale du pseudo, ou null : on montre alors une pierre noire. */
  initiale: string | null;
  nom: string;
  /** Ligne sous le nom. */
  detail: string;
  /** Série de jours, affichée seulement si elle vaut au moins 1. */
  serie: number;
}

/** Données de la carte, pour un joueur connecté (profil chargé) ou non. */
export function identite(profil: { pseudo: string | null; cote: number } | null, serie: number): Identite {
  if (!profil) return { initiale: null, nom: 'Invité', detail: 'Sans compte, tout reste sur ce téléphone.', serie: 0 };
  const nom = profil.pseudo?.trim() || 'Sans pseudo';
  const initiale = profil.pseudo?.trim() ? [...profil.pseudo.trim()][0].toUpperCase() : null;
  return { initiale, nom, detail: `Cote ${profil.cote}`, serie: Math.max(0, Math.floor(serie)) };
}

/** Texte lisible de la série (« 1 jour », « 12 jours »). */
export function texteSerie(n: number): string {
  return `${n} jour${n > 1 ? 's' : ''}`;
}
