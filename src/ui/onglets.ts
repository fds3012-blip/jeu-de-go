// Onglets de la barre de navigation du bas (issue #51). Icônes : IconesNav.tsx.
export type Onglet = 'jouer' | 'apprendre' | 'problemes' | 'profil';

export const ONGLETS: readonly { id: Onglet; libelle: string }[] = [
  { id: 'jouer', libelle: 'Jouer' },
  { id: 'apprendre', libelle: 'Apprendre' },
  { id: 'problemes', libelle: 'Problèmes' },
  { id: 'profil', libelle: 'Profil' },
];
