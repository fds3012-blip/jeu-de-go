import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromLabel } from '../go/coords';
import { fromRows } from '../go/position';
import { choisirLangue } from '../content/i18n';
import { ORDRE_THEMES, THEMES_GOBAN, contraste } from './boardArt';
import { CURSEUR, TOUCHE_LIRE, annonceApresCoup, lirePlateau, nomIntersection } from './boardA11y';

// Issue #116 : module pur des annonces du goban (clavier et lecteur d'écran).
const N = 9;
const at = (l: string) => fromLabel(l, N);

describe('Lire le plateau', () => {
  it('dit que le plateau est vide', () => {
    expect(lirePlateau(new Int8Array(N * N), N)).toBe('Le plateau est vide.');
  });

  it('compte les pierres puis lit les lignes occupées de haut en bas, de gauche à droite', () => {
    const b = fromRows([
      '.........',
      '.........',
      '..X......', // ligne 7
      '.........',
      '...XO....', // ligne 5
      '.........',
      '.........',
      '.........',
      'O........', // ligne 1
    ]).pos.board;
    expect(lirePlateau(b, N)).toBe(
      '2 pierres noires, 2 pierres blanches. Ligne 7 : C7 noire. Ligne 5 : D5 noire, E5 blanche. Ligne 1 : A1 blanche. Les autres lignes sont vides.');
  });

  it('accorde au singulier', () => {
    const b = new Int8Array(N * N);
    b[at('E5')] = 1;
    expect(lirePlateau(b, N)).toMatch(/^1 pierre noire, 0 pierre blanche\. Ligne 5 : E5 noire\./);
  });

  it('saute la lettre I sur un 19 × 19 et numérote depuis le bas', () => {
    const b = new Int8Array(19 * 19);
    b[fromLabel('J19', 19)] = 2;
    b[fromLabel('T1', 19)] = 1;
    expect(lirePlateau(b, 19)).toBe('1 pierre noire, 1 pierre blanche. Ligne 19 : J19 blanche. Ligne 1 : T1 noire. Les autres lignes sont vides.');
  });

  it('se commande avec la touche L', () => {
    expect(TOUCHE_LIRE).toBe('l');
  });
});

describe('annonce après un coup', () => {
  it('le coup seul', () => {
    const b = new Int8Array(N * N);
    b[at('D4')] = 1;
    expect(annonceApresCoup(b, at('D4'), 0, N)).toBe('Noir joue D4');
  });

  it("le coup de l'adversaire nommé, sa prise, puis l'atari", () => {
    // Blanc (Pomme) joue D5 : la pierre noire D4 n'a plus qu'une liberté, en D3.
    const b = fromRows(['.........', '.........', '.........', '.........', '...O.....', '..OXO....', '.........', '.........', '.........']).pos.board;
    expect(annonceApresCoup(b, at('D5'), 1, N, { 2: 'Pomme' }))
      .toBe("Pomme a joué D5 et prend 1 pierre. Atari : ta pierre D4 n'a plus qu'une liberté, en D3.");
  });
});

describe('en anglais', () => {
  beforeEach(() => choisirLangue('en'));
  afterEach(() => choisirLangue('fr'));

  it('lit le plateau et les cases', () => {
    const b = new Int8Array(N * N);
    b[at('D5')] = 1; b[at('E5')] = 2; b[at('C3')] = 2;
    expect(lirePlateau(b, N)).toBe('1 black stone, 2 white stones. Row 5: D5 black, E5 white. Row 3: C3 white. The other rows are empty.');
    expect(lirePlateau(new Int8Array(N * N), N)).toBe('The board is empty.');
    expect(nomIntersection(at('E5'), b, N)).toBe('E5, white stone');
  });
});

describe('contraste du curseur clavier (WCAG 1.4.11, 3:1)', () => {
  // Le goban est le même en mode sombre et en mode clair : seul le thème du bois change le fond sous le curseur.
  const noires = ['#5b5f5d', '#2e3130', '#151716', '#050606'];

  it.each(ORDRE_THEMES)('thème %s : le liseré se détache du bois et des pierres blanches', id => {
    const th = THEMES_GOBAN[id];
    for (const c of [...th.fond, ...th.blanche]) expect(contraste(CURSEUR.lisere, c), `${CURSEUR.lisere} sur ${c}`).toBeGreaterThanOrEqual(3);
  });

  it("l'anneau jade se détache des pierres noires et de son liseré", () => {
    for (const c of noires) expect(contraste(CURSEUR.anneau, c), `${CURSEUR.anneau} sur ${c}`).toBeGreaterThanOrEqual(3);
    expect(contraste(CURSEUR.anneau, CURSEUR.lisere)).toBeGreaterThanOrEqual(3);
  });
});
