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
  ['Profil', 'nav.profil', ['profil.parcours']],
  ['Révisions', 'titre.revisions', ['accueil.revisions.titre', 'seance.titre', 'revision.titre']],
  ['Revoir la partie', 'direct.revoir', ['fin.revoir']],
  ['Statistiques', 'stats.titre', ['stats.ligne']],
  ['Ton niveau de départ', 'titre.placement', ['placement.titre', 'placement.profilFaire', 'placement.profilRefaire', 'cote.lignePlacement']],
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

  it('la partie de découverte : le nom accessible de la tuile et la ligne de « Plus » commencent par son nom', () => {
    for (const l of ['fr', 'en'] as const) {
      expect((LANGUES[l]['accueil.decouverte'] as string).startsWith(LANGUES[l]['titre.decouverte'] as string)).toBe(true);
    }
  });

  it('les anciens noms ont disparu des textes', () => {
    const fr = Object.values(LANGUES.fr).filter((v): v is string => typeof v === 'string').join('\n');
    const anglais = Object.values(LANGUES.en).filter((v): v is string => typeof v === 'string').join('\n');
    for (const ancien of ['Révisions du jour', 'Révision du jour', 'Ton parcours', 'Revoir ma partie', 'Mes statistiques', 'Faire le placement']) {
      expect(fr).not.toContain(ancien);
    }
    for (const ancien of ['Today’s reviews', 'Daily review', 'Your journey', 'Review my game', 'My statistics', 'Take the placement']) {
      expect(anglais).not.toContain(ancien);
    }
  });

  it('« Plus » ne cite plus la partie guidée, partie dans Apprendre (#589)', () => {
    for (const l of ['fr', 'en'] as const) {
      const aria = LANGUES[l]['mode.plus.aria'] as string;
      expect(aria).not.toMatch(/guid/i);
      // Le nom accessible commence par le texte visible (WCAG 2.5.3).
      expect(aria.startsWith(LANGUES[l]['mode.plus'] as string)).toBe(true);
    }
    expect(Object.keys(LANGUES.fr)).not.toContain('mode.plus.detail');
  });
});
