// Ouvrir l'aide depuis n'importe quel écran (issue #362), sans faire passer de fonction par les props :
// un écran appelle `ouvrirAide(...)`, App écoute et pose la feuille d'aide par-dessus l'écran, qui reste monté
// (une partie en cours garde sa position, son chrono, son historique).
//
// Branchement prévu dans la partie (#381, menu « Plus » en refonte) : `<BoutonAide depuis="partie" fiche={...} />`
// (src/ui/BoutonAide.tsx), avec la fiche « compter » pendant le comptage, « regles » sinon.
import type { Fiche, IdMot } from '../content/aide';

/** D'où l'aide est ouverte : propriété `depuis` de l'événement `aide_ouverte`. */
export type Depuis = 'profil' | 'lecon' | 'partie' | 'clavier';

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
