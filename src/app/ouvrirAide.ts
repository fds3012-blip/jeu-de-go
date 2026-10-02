// Ouvrir l'aide depuis n'importe quel écran (issue #362), sans faire passer de fonction par les props :
// un écran appelle `ouvrirAide(...)`, App écoute et pose la feuille d'aide par-dessus l'écran, qui reste monté
// (une partie en cours garde sa position, son chrono, son historique).
//
// Dans la partie : `<BoutonAide depuis="partie" />` au bout du bandeau du haut (Game.tsx), fiche « compter » pendant le comptage.
import type { Fiche, IdMot } from '../content/aide';

/** D'où l'aide est ouverte : propriété `depuis` de l'événement `aide_ouverte`. */
export type Depuis = 'profil' | 'lecon' | 'probleme' | 'partie' | 'clavier';

export interface Ouverture { fiche: Fiche; mot?: IdMot; depuis: Depuis }

type Ecoute = (o: Ouverture) => void;
const ecoutes = new Set<Ecoute>();

/** Ouvre l'aide sur une fiche ; `mot` ouvre le glossaire sur ce mot. */
export function ouvrirAide(o: Ouverture): void {
  for (const f of ecoutes) f(o);
}

/** App s'abonne une fois ; renvoie la fonction de désabonnement. */
export function ecouterAide(f: Ecoute): () => void {
  ecoutes.add(f);
  return () => { ecoutes.delete(f); };
}

/**
 * Raccourci clavier « ? » : ouvre l'aide, sauf si l'on écrit dans un champ.
 * Les lecteurs d'écran et les claviers externes (tablettes) y ont accès partout, partie comprise.
 */
export function estRaccourciAide(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>): boolean {
  if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return false;
  const el = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = el?.tagName?.toLowerCase();
  return !(tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable);
}

// Table gardée ici, sans le contenu de l'aide : App l'importe pour le raccourci « ? » sans alourdir le premier écran.
/** Ce que le « ? » d'une leçon ouvre : le mot qu'elle enseigne, ou « Comment on compte ? » pour la leçon de comptage. */
export const AIDE_DES_LECONS: Record<string, { fiche: Fiche; mot?: IdMot }> = {
  l1: { fiche: 'mots', mot: 'liberte' }, l2: { fiche: 'mots', mot: 'atari' }, l3: { fiche: 'mots', mot: 'doubleAtari' },
  l4: { fiche: 'mots', mot: 'ko' }, l5: { fiche: 'mots', mot: 'oeil' }, l6: { fiche: 'mots', mot: 'territoire' },
  l7: { fiche: 'compter' }, l9: { fiche: 'mots', mot: 'filet' }, l10: { fiche: 'mots', mot: 'priseEnRetour' },
  l11: { fiche: 'mots', mot: 'semeai' }, l12: { fiche: 'mots', mot: 'fauxOeil' }, l13: { fiche: 'mots', mot: 'pointVital' },
  l14: { fiche: 'mots', mot: 'seki' }, l15: { fiche: 'mots', mot: 'dame' }, l16: { fiche: 'compter' },
};

/** Fiche à ouvrir depuis une leçon ; les règles quand la leçon n'a pas de mot à elle (ouverture, par exemple). */
export function ficheDeLecon(lecon: string): { fiche: Fiche; mot?: IdMot } {
  return AIDE_DES_LECONS[lecon] ?? { fiche: 'regles' };
}
