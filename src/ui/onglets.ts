// Onglets de la barre de navigation du bas (issue #51). Icônes : IconesNav.tsx. Libellés traduits (#167).
import { t, type Cle } from '../content/i18n';

export type Onglet = 'jouer' | 'apprendre' | 'problemes' | 'profil';

// #465 : libellé court, montré seulement quand l'onglet est trop étroit pour le nom entier (zoom 200 %, texte agrandi).
// Il commence comme le nom entier (« Appr. » pour « Apprendre ») : ce qu'on lit reste dans le nom accessible (WCAG 2.5.3).
// Le lecteur d'écran entend toujours le nom entier.
const onglet = (id: Onglet, court?: Cle & `nav.court.${Onglet}`) => ({
  id, cle: `nav.${id}` as Cle & `nav.${Onglet}`,
  get libelle() { return t(this.cle); },
  get court() { return court ? t(court) : t(this.cle); },
});

export const ONGLETS: readonly { id: Onglet; cle: `nav.${Onglet}`; readonly libelle: string; readonly court: string }[] = [
  onglet('jouer'),
  onglet('apprendre', 'nav.court.apprendre'),
  onglet('problemes', 'nav.court.problemes'),
  onglet('profil'),
];
