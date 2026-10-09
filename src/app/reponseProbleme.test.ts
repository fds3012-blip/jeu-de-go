// #497 : problèmes classiques, réponse montrée : pourquoi c'est la réponse, au lieu de « Rejoue-la pour la retenir ».
// Positions et réponses inchangées : on lit les problèmes tels qu'ils sont (ALL_PUZZLES, PROBLEMES_EN).
import { afterEach, describe, expect, it } from 'vitest';
import { parsePuzzle, type Puzzle } from '../data/puzzles';
import { ALL_PUZZLES, BASE_PUZZLES } from '../content/puzzles';
import { localiserProbleme } from '../content/problemesLangue';
import { choisirLangue } from '../content/i18n';
import { sansFelicitations, texteReponseVue } from './reponseProbleme';

afterEach(() => choisirLangue('fr'));

const TOUS = ALL_PUZZLES.map(r => parsePuzzle(r)!);
const par = (id: string): Puzzle => TOUS.find(p => p.id === id)!;
const FELICITATIONS = /\b(bravo|superbe|bien joué|bien vu|parfait|magnifique|well done|superb|nice move|well spotted|perfect|magnificent)\b/i;

describe('les 6 problèmes de base (sans texte de solution) : un fait calculé par les règles', () => {
  it('aucun n’a de texte de solution : l’explication vient de la position', () => {
    expect(BASE_PUZZLES.every(p => p.explanation === null)).toBe(true);
  });

  it.each([
    ['b1', 'Voilà la réponse : E5. E5 prend une pierre blanche.'],
    ['b2', 'Voilà la réponse : E3. E3 met une pierre blanche en atari : il ne lui reste qu’une liberté.'],
    ['b3', 'Voilà la réponse : E5. E5 met 2 pierres blanches en atari, dans deux groupes séparés : c’est un double atari.'],
    ['b4', 'Voilà la réponse : D4. D4 sort ta pierre de l’atari (il ne lui restait qu’une liberté) : elle a maintenant 3 libertés.'],
    ['b5', 'Voilà la réponse : F6. F6 prend une pierre blanche.'],
    ['b6', 'Voilà une des bonnes réponses : F5. F5 met une pierre blanche en atari : il ne lui reste qu’une liberté.'],
  ])('%s', (id, texte) => {
    expect(texteReponseVue(par(id))).toBe(texte);
  });

  it('en anglais', () => {
    choisirLangue('en');
    expect(texteReponseVue(localiserProbleme(par('b3'), 'en'))).toBe('Here’s the answer: E5. E5 puts 2 white stones in atari, in two separate groups: it’s a double atari.');
  });
});

describe('problèmes avec un texte de solution : ce texte, sans les félicitations', () => {
  it('c1 (double atari), en français et en anglais', () => {
    expect(texteReponseVue(par('c1'))).toBe('Voilà la réponse : E5. En E5, tu mets les deux pierres en atari : il ne leur reste qu\'une liberté, un seul point vide à côté d\'elles. C\'est un double atari. Blanc ne peut en sauver qu\'une, et tu prends l\'autre au coup suivant.');
    choisirLangue('en');
    expect(texteReponseVue(localiserProbleme(par('c1'), 'en'))).toBe('Here’s the answer: E5. At E5, you put both stones in atari: each has only one liberty left, a single empty point next to it. This is a double atari. White can save only one, and you take the other on your next move.');
  });

  it('exclamations retirées, jamais le reste du texte', () => {
    expect(sansFelicitations('Bravo ! En E5, tu prends.')).toBe('En E5, tu prends.');
    expect(sansFelicitations('Bravo ! En E5, tu prends.')).toBe('En E5, tu prends.');
    expect(sansFelicitations('Well done! E2 captures it.')).toBe('E2 captures it.');
    expect(sansFelicitations("C'est ça ! Le ko.")).toBe('Le ko.');
    expect(sansFelicitations('Exactement trois libertés.')).toBe('Exactement trois libertés.');
    expect(sansFelicitations('Bravo !')).toBeNull();
    expect(sansFelicitations(null)).toBeNull();
  });

  for (const langue of ['fr', 'en'] as const) {
    it(`${langue} : chaque problème (${TOUS.length}) a une explication, sans félicitations ni « retiens-la »`, () => {
      choisirLangue(langue);
      for (const brut of TOUS) {
        const pz = localiserProbleme(brut, langue), texte = texteReponseVue(pz);
        const debut = langue === 'fr' ? /^Voilà (la réponse|une des bonnes réponses) : [A-T]\d{1,2}\. / : /^Here’s (the answer|one of the right answers): [A-T]\d{1,2}\. /;
        expect(texte, pz.id).toMatch(debut);
        const reste = texte.replace(debut, '');
        expect(reste.length, pz.id).toBeGreaterThan(10);
        expect(reste.slice(0, 30), pz.id).not.toMatch(FELICITATIONS);
        expect(texte, pz.id).not.toMatch(/retenir|remember it/i);
      }
    });
  }
});
