// Adresse de chaque écran (C6, lot N8 de docs/ux/architecture-pages-2026-10.md). Logique pure, sans React ni DOM.
//
// L'adresse suit l'écran affiché (`history.replaceState`, sans nouvelle entrée d'historique : le retour du système
// reste celui de src/app/retourSysteme.ts). Recharger la page ou ouvrir un lien rouvre le même écran.
//
//   /                          Jouer
//   /apprendre                 sommaire d'Apprendre
//   /apprendre/<thème>         page d'un thème (/apprendre/vie-mort)
//   /apprendre/ouvertures      Ouvertures
//   /apprendre/avec-mochi      Jouer avec Mochi
//   /apprendre/lecon/<id>      une leçon (/apprendre/lecon/l5)
//   /problemes                 sommaire de Problèmes
//   /problemes/<id>            un problème (/problemes/a01)
//   /profil                    sommaire du Profil
//   /profil/<rubrique>         une rubrique (/profil/reglages)
//
// Les liens d'avant restent ceux qu'ils étaient : `#defi=`, `#partie=`, `?go-du-jour=`, `/j/N`, `/confidentialite`.
// Les réécritures vers l'app : vercel.json ; hors ligne : public/sw.js.
import type { Onglet } from '../ui/onglets';

export interface Adresse {
  readonly onglet: Onglet;
  readonly theme?: string;
  readonly ouvertures?: boolean;
  readonly avecMochi?: boolean;
  readonly lecon?: string;
  readonly probleme?: string;
  readonly rubrique?: string;
}

/**
 * Rubriques du Profil qui se rouvrent seules. Pas « Profil de {pseudo} », l'étude ni l'import : il leur faut ce qui les a
 * ouvertes (le joueur regardé, la copie, la garde du compte).
 */
export const RUBRIQUES = ['niveau', 'reglages', 'installer', 'rappel', 'compte', 'conditions', 'parties', 'amis', 'cote', 'stats',
  'semaine', 'donnees', 'mentions', 'photo'] as const;
export type Rubrique = (typeof RUBRIQUES)[number];

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const OUVERTURES = 'ouvertures';
const AVEC_MOCHI = 'avec-mochi';

/** L'écran nommé par un chemin, ou `null` : chemin d'avant ou inconnu (l'app fait alors comme avant). */
export function lireAdresse(chemin: string, themes: readonly string[]): Adresse | null {
  const p = chemin.replace(/\/+$/, '').split('/').slice(1);
  if (p.length === 0 || (p.length === 1 && p[0] === '')) return { onglet: 'jouer' };
  if (!p.every(s => ID.test(s))) return null;
  const [racine, a, b] = p;
  if (racine === 'apprendre') {
    if (p.length === 1) return { onglet: 'apprendre' };
    if (p.length === 3 && a === 'lecon') return { onglet: 'apprendre', lecon: b };
    if (p.length !== 2) return null;
    if (a === OUVERTURES) return { onglet: 'apprendre', ouvertures: true };
    if (a === AVEC_MOCHI) return { onglet: 'apprendre', avecMochi: true };
    return themes.includes(a) ? { onglet: 'apprendre', theme: a } : null;
  }
  if (racine === 'problemes') {
    if (p.length === 1) return { onglet: 'problemes' };
    return p.length === 2 ? { onglet: 'problemes', probleme: a } : null;
  }
  if (racine === 'profil') {
    if (p.length === 1) return { onglet: 'profil' };
    return p.length === 2 && (RUBRIQUES as readonly string[]).includes(a) ? { onglet: 'profil', rubrique: a } : null;
  }
  return null;
}

/** Le chemin d'un écran. Une rubrique hors de la liste reste sur `/profil`. */
export function cheminDe(a: Adresse): string {
  switch (a.onglet) {
    case 'jouer': return '/';
    case 'apprendre':
      if (a.lecon) return `/apprendre/lecon/${a.lecon}`;
      if (a.theme) return `/apprendre/${a.theme}`;
      if (a.avecMochi) return `/apprendre/${AVEC_MOCHI}`;
      if (a.ouvertures) return `/apprendre/${OUVERTURES}`;
      return '/apprendre';
    case 'problemes': return a.probleme ? `/problemes/${a.probleme}` : '/problemes';
    case 'profil': return a.rubrique && (RUBRIQUES as readonly string[]).includes(a.rubrique) ? `/profil/${a.rubrique}` : '/profil';
  }
}

/** Vrai pour un chemin de l'app (adresse d'un écran) : la page servie est celle de l'app. */
export const estCheminApp = (chemin: string): boolean => chemin === '/' || /^\/(apprendre|problemes|profil)(\/|$)/.test(chemin);
