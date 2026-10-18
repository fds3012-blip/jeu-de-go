// #604 (lot N7, règle A9 de DESIGN.md) : un nom par chose. Le libellé qui mène à un écran est le titre de cet écran
// et le titre du document (titreEcran.ts), en français comme en anglais. Tableau « Noms » :
// docs/ux/architecture-pages-2026-10.md, § 5.4.
import { describe, expect, it } from 'vitest';
import { fr as frAccueil } from '../content/i18n/fr';
import { frEcrans } from '../content/i18n/frEcrans';
import { en } from '../content/i18n/en';
import { CATALOGUE_CLUB } from '../content/i18n/club';
import { CATALOGUE_COTE } from '../content/i18n/cote';
import { CATALOGUE_DIRECT } from '../content/i18n/direct';

const LANGUES = {
  fr: { ...frAccueil, ...frEcrans, ...CATALOGUE_CLUB.fr, ...CATALOGUE_COTE.fr, ...CATALOGUE_DIRECT.fr },
  en: { ...en, ...CATALOGUE_CLUB.en, ...CATALOGUE_COTE.en, ...CATALOGUE_DIRECT.en },
} as Record<'fr' | 'en', Record<string, unknown>>;

/** [chose, titre de l'écran (et du document), libellés qui y mènent ou le nomment]. `{n}` : compteur ajouté au nom. */
const NOMS: [string, string, string[]][] = [
  // #611 : l'en-tête de l'onglet dit « Profil » ; « Ton parcours » nomme la section de progression, pas l'écran.
  // #653 : les révisions ont une seule maison et un seul nom, « Rejouer tes erreurs » (entrée de Problèmes, séance, tuile de l'accueil).
  ['Rejouer tes erreurs', 'titre.revisions', ['accueil.revisions.titre', 'seance.titre', 'erreurs.titre']],
  ['Revoir la partie', 'direct.revoir', ['fin.revoir']],
  ['Statistiques', 'stats.titre', ['stats.ligne']],
  ['Ton niveau de départ', 'titre.placement', ['placement.titre', 'placement.profilFaire']],
  // La tuile de l'accueil garde son nom court (« Découverte ») : son nom accessible commence par le nom entier.
  ['Partie de découverte', 'titre.decouverte', []],
  ['Partie guidée', 'titre.guidee', []],
];

describe('un nom par chose (#604, A9)', () => {
  for (const l of ['fr', 'en'] as const) {
    const c = LANGUES[l];
    it.each(NOMS)(`${l} : %s`, (_, titre, libelles) => {
      const nom = c[titre];
      expect(typeof nom, titre).toBe('string');
      for (const cle of libelles) {
        expect(typeof c[cle], cle).toBe('string');
        // « Révisions ({n}) » : le nom, puis le compteur entre parenthèses.
        expect((c[cle] as string).replace(/ \(\{n\}\)$/, ''), cle).toBe(nom);
      }
    });
  }

  it('la partie de découverte : la carte d’Apprendre et le bouton de fin de l’introduction commencent par son nom (#647 : plus de tuile sur l’accueil)', () => {
    for (const l of ['fr', 'en'] as const) {
      const nom = LANGUES[l]['titre.decouverte'] as string;
      expect(LANGUES[l]['apprendre.decouverte']).toBe(nom);
      expect((LANGUES[l]['intro.fin.decouverte'] as string).startsWith(nom)).toBe(true);
      // #677 : la version complète aussi ; elle disait « Jouer avec Mochi », le nom de l'entrée d'Apprendre.
      expect((LANGUES[l]['intro.fin.jouer'] as string).startsWith(nom), 'intro.fin.jouer').toBe(true);
      expect(LANGUES[l]['intro.fin.jouer']).not.toBe(LANGUES[l]['apprendre.avecMochi']);
    }
  });

  it('les anciens noms ont disparu des textes', () => {
    const fr = Object.values(LANGUES.fr).filter((v): v is string => typeof v === 'string').join('\n');
    const anglais = Object.values(LANGUES.en).filter((v): v is string => typeof v === 'string').join('\n');
    for (const ancien of ['Révisions du jour', 'Révision du jour', 'Revoir ma partie', 'Mes statistiques', 'Faire le placement']) {
      expect(fr).not.toContain(ancien);
    }
    for (const ancien of ['Today’s reviews', 'Daily review', 'Review my game', 'My statistics', 'Take the placement']) {
      expect(anglais).not.toContain(ancien);
    }
  });

  it('#647 : la feuille « Plus » de l’accueil a disparu, ses textes aussi', () => {
    for (const l of ['fr', 'en'] as const) {
      for (const cle of ['mode.plus', 'mode.plus.aria', 'mode.plus.titre', 'mode.decouverte', 'mode.decouverte.texte', 'mode.deux.texte', 'accueil.decouverte']) {
        expect(Object.keys(LANGUES[l]), cle).not.toContain(cle);
      }
    }
  });
});
