// Accueil v3 : « la bonne chose à faire aujourd'hui » en premier. Logique pure, sans React.
//
// Le bouton principal reste la partie (une seule action principale par écran, #119, #236). Sous lui, les tuiles
// sont rangées par ce qui compte aujourd'hui, et la première est mise en avant (plus grande, mini-plateau, état) :
// 1. un défi d'un ami où c'est ton tour (il attend) ;
// 2. le Go du jour à faire (la série en dépend) ;
// 3. la leçon suivante ;
// 4. le Go du jour déjà fait (un constat, pas un appel).
// Au tout premier lancement, rien n'est mis en avant : la seule chose à faire est la première partie (#236, N4).

export type GenreTuile = 'defi' | 'goDuJour' | 'lecon';

export interface TuileDuJour {
  genre: GenreTuile;
  /** Mise en avant : la première tuile, quand elle est un appel (défi, Go du jour à faire, leçon). */
  enAvant: boolean;
}

export interface ContexteDuJour {
  /** Tout premier lancement (aucune partie) : rien n'est mis en avant. */
  premier: boolean;
  /** Défis d'amis où c'est ton tour. */
  defis: number;
  /** Tuile du Go du jour : absente, à faire, faite, ou sans état (premier lancement, autre appel à l'écran). */
  goDuJour: 'aFaire' | 'fait' | 'neutre' | null;
  /** Une leçon suivante existe. */
  lecon: boolean;
}

/** Ordre des tuiles de l'accueil, et laquelle est mise en avant. */
export function ordreDuJour(c: ContexteDuJour): TuileDuJour[] {
  const tuiles: TuileDuJour[] = [];
  if (c.defis > 0) tuiles.push({ genre: 'defi', enAvant: true });
  const go = c.goDuJour !== null;
  if (go && c.goDuJour === 'aFaire') tuiles.push({ genre: 'goDuJour', enAvant: true });
  if (c.lecon) tuiles.push({ genre: 'lecon', enAvant: !c.premier && c.goDuJour !== 'aFaire' && c.defis === 0 });
  if (go && c.goDuJour !== 'aFaire') tuiles.push({ genre: 'goDuJour', enAvant: false });
  // Une seule tuile en avant, jamais au premier lancement.
  let vue = false;
  return tuiles.map(t => {
    const enAvant = t.enAvant && !c.premier && !vue;
    if (enAvant) vue = true;
    return { ...t, enAvant };
  });
}
