// Go du jour léger (#433) : src/content/goDuJour.gen.ts suit src/content/puzzles.ts, et l'accueil voit exactement
// le problème qu'il voyait avec la liste complète (même numéro, même titre, même position, en français et en anglais).
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_PUZZLES, CALENDRIER_GO_DU_JOUR } from '../src/content/puzzles';
import { parsePuzzles } from '../src/data/puzzles';
import { problemeDuJour, problemeDuNumero } from '../src/app/goDuJour';
import { choisirLangue } from '../src/content/i18n';
import { genererGoDuJour } from './goDuJour';

const FICHIER = new URL('../src/content/goDuJour.gen.ts', import.meta.url);

describe('Go du jour léger (#433)', () => {
  it('src/content/goDuJour.gen.ts est à jour (sinon : npm run go-du-jour)', () => {
    const attendu = genererGoDuJour(ALL_PUZZLES, CALENDRIER_GO_DU_JOUR);
    if (process.env.MAJ_GO_DU_JOUR === '1') writeFileSync(FICHIER, attendu);
    expect(readFileSync(FICHIER, 'utf8'), 'src/content/goDuJour.gen.ts est en retard : lance `npm run go-du-jour`').toBe(attendu);
  });

});

// En mise à jour (`npm run go-du-jour`), le module importé est encore l'ancien : comparaison au prochain lancement.
describe.skipIf(process.env.MAJ_GO_DU_JOUR === '1')('Go du jour léger (#433) : accueil inchangé', () => {
  afterEach(() => choisirLangue('fr'));
  it.each(['fr', 'en'] as const)('même problème que la liste complète, jour après jour (%s)', l => {
    choisirLangue(l);
    const complets = parsePuzzles(ALL_PUZZLES);
    for (let n = -3; n <= 2 * complets.length + 5; n++) {
      const complet = problemeDuNumero(complets, n);
      const leger = problemeDuJour(n);
      expect(leger && { id: leger.id, title: leger.title, rows: leger.rows }, `n° ${n}`)
        .toEqual(complet && { id: complet.id, title: complet.title, rows: complet.rows });
    }
  });
});
