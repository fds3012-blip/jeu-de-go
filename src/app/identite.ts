// Carte d'identité du Profil (issue #50) : initiale, pseudo et série, en une ligne. Textes traduits (#167).
// #214 : aucune cote affichée (décision de Florian) ; la ligne sous le pseudo dit ce que le compte garde.
import { t } from '../content/i18n/secondaires';

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
  // Sans compte, la série de l'appareil s'affiche aussi (issue #161).
  if (!profil) return { initiale: null, nom: t('profil.invite'), detail: t('profil.inviteDetail'), serie: Math.max(0, Math.floor(serie)) };
  const nom = profil.pseudo?.trim() || t('profil.sansPseudo');
  const initiale = profil.pseudo?.trim() ? [...profil.pseudo.trim()][0].toUpperCase() : null;
  return { initiale, nom, detail: t('profil.connecteDetail'), serie: Math.max(0, Math.floor(serie)) };
}

/** Texte lisible de la série (« 1 jour », « 12 jours »). */
export function texteSerie(n: number): string {
  return t('profil.jours', { n });
}
