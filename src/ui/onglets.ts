// Onglets de la barre de navigation du bas (issue #51). Icônes : IconesNav.tsx. Libellés traduits (#167).
import { t, type Cle } from '../content/i18n';

export type Onglet = 'jouer' | 'apprendre' | 'problemes' | 'profil';

const onglet = (id: Onglet) => ({ id, cle: `nav.${id}` as Cle & `nav.${Onglet}`, get libelle() { return t(this.cle); } });

export const ONGLETS: readonly { id: Onglet; cle: `nav.${Onglet}`; readonly libelle: string }[] = [
  onglet('jouer'),
  onglet('apprendre'),
  onglet('problemes'),
  onglet('profil'),
];
