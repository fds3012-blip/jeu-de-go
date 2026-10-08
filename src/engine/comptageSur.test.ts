// Comptage sûr des 3 premières parties (#486) : marquer seulement ce qui est sûr, laisser le doute au joueur.
// Toutes les recherches sont bornées (enclos, budget de positions, délai) : aucun test ne lance de recherche géante.
import { fromRows } from '../go/position';
import { score } from '../go/score';
import { comptageAuto } from './dead';
import { CAS } from './dead.fixtures';
import { comptageSur, enclos, trancherParPreuve, PREUVE } from './comptageSur';
import { proposeComptage } from './index';
import { modeComptage } from '../app/partie';

// Fins de partie 9 × 9 : Noir tient la gauche, Blanc la droite (colonnes 7 et 8). Les coins en haut à gauche varient.
const droite = (lignes: string[]) => [...lignes, ...Array(9 - lignes.length).fill('......XO.')];
const POS = {
  // Groupe blanc à œil carré de quatre points : mort. Les simulations hésitent.
  carre: droite(['..OX..XO.', '..OX..XO.', 'OOOX..XO.', 'XXXX..XO.']),
  // Œil de trois points dont Noir a déjà pris le point vital : mort, mais les simulations le croient vivant.
  vital: droite(['.X.OX.XO.', 'OOOOX.XO.', 'XXXXX.XO.']),
  // Œil de trois points vide : vit si Blanc joue, meurt si Noir joue. Douteux, jamais marqué.
  instable: droite(['...OX.XO.', 'OOOOX.XO.', 'XXXXX.XO.']),
  // Œil de deux points : mort, et tout le monde est d'accord.
  coin: droite(['..OX..XO.', 'OOOX..XO.', 'XXXX..XO.']),
  // Six pierres blanches au bord, œil de six points : vivant.
  vivant: ['......XO.', 'OOOOOOXO.', 'XXXXXXXO.', '.......O.', '......XO.', '......XO.', '......XO.', '......XO.', '......XO.'],
};
const idx = (x: number, y: number) => y * 9 + x;
const tri = (a: number[]) => [...a].sort((x, y) => x - y);

describe('comptage sûr (#486)', () => {
  it('œil carré : les simulations doutent, la preuve tranche, comptage automatique', () => {
    const { pos } = fromRows(POS.carre, 1);
    const base = comptageAuto(pos, { seed: 7 });
    const blancs = [idx(2, 0), idx(2, 1), idx(0, 2), idx(1, 2), idx(2, 2)];
    expect(base.incertains).toEqual(blancs);
    const t = trancherParPreuve(pos, base);
    expect(t.morts).toEqual(blancs);
    const s = comptageSur(pos, base, t);
    expect(s).toEqual({ dead: blancs, incertains: [], prouves: 1 });
    expect(modeComptage(true, s.incertains)).toBe('auto');
  });

  it('point vital pris : la preuve corrige les simulations (groupe mort marqué)', () => {
    const { pos } = fromRows(POS.vital, 1);
    const base = comptageAuto(pos, { seed: 7 });
    expect(base.dead).toEqual([]); // les simulations le croient vivant
    const s = comptageSur(pos, base, trancherParPreuve(pos, base));
    expect(s.dead).toEqual([idx(3, 0), idx(0, 1), idx(1, 1), idx(2, 1), idx(3, 1)]);
    expect(s.incertains).toEqual([]);
    // Score juste sans rien toucher : les 5 blanches sont prisonnières, leur coin est à Noir.
    const sc = score(pos, 6.5, 'japanese', new Set(s.dead));
    expect(sc.black).toBeGreaterThan(score(pos, 6.5, 'japanese').black);
  });

  it('œil de trois points vide : douteux, ni marqué mort ni dit vivant', () => {
    const { pos } = fromRows(POS.instable, 1);
    const base = comptageAuto(pos, { seed: 7 });
    const blancs = [idx(3, 0), idx(0, 1), idx(1, 1), idx(2, 1), idx(3, 1)];
    expect(base.incertains).toEqual(blancs);
    const t = trancherParPreuve(pos, base);
    expect(t.morts).toEqual([]);
    expect(t.vivants.filter(p => blancs.includes(p))).toEqual([]);
    const s = comptageSur(pos, base, t);
    expect(s.dead).toEqual([]);
    expect(s.incertains).toEqual(blancs);
    expect(modeComptage(true, s.incertains)).toBe('manuel');
  });

  it('œil de deux points : mort, preuve et simulations d\'accord', () => {
    const { pos } = fromRows(POS.coin, 1);
    const base = comptageAuto(pos, { seed: 7 });
    const s = comptageSur(pos, base, trancherParPreuve(pos, base));
    expect(s.dead).toEqual([idx(2, 0), idx(0, 1), idx(1, 1), idx(2, 1)]);
    expect(s).toMatchObject({ incertains: [], prouves: 0 });
  });

  it('œil de six points au bord : prouvé vivant, jamais marqué', () => {
    const { pos } = fromRows(POS.vivant, 1);
    const base = comptageAuto(pos, { seed: 7 });
    const t = trancherParPreuve(pos, base);
    expect(t.vivants).toEqual(expect.arrayContaining([idx(0, 1), idx(5, 1)]));
    expect(comptageSur(pos, base, t).dead).toEqual([]);
  });

  for (const { nom, rows } of CAS) {
    it(`${nom} : mêmes pierres mortes qu'attendu, rien d'incertain`, () => {
      const { pos, marked } = fromRows(rows, 1);
      const base = comptageAuto(pos, { seed: 7 });
      const s = comptageSur(pos, base, trancherParPreuve(pos, base));
      expect(s.dead).toEqual(tri(marked));
      expect(s.incertains).toEqual([]);
    });
  }

  it('partie inachevée : les groupes incertains ne sont pas proposés morts', () => {
    // Pierres blanches dans une grande zone noire encore ouverte : trop grand pour une preuve, le doute reste.
    const { pos } = fromRows(['.........', '.........', '.........', '...XO....', '...XO....', '...X.....', '.........', '.........', '.........'], 1);
    const base = comptageAuto(pos, { seed: 7 });
    expect(base.incertains.length).toBeGreaterThan(0);
    const s = comptageSur(pos, base, trancherParPreuve(pos, base));
    expect(s.incertains).toEqual(base.incertains);
    expect(s.dead.filter(p => s.incertains.includes(p))).toEqual([]);
  });

  it('un mort proposé mais incertain n\'est plus grisé', () => {
    const { pos } = fromRows(POS.instable, 1);
    const p = idx(3, 0), g = [idx(3, 0), idx(0, 1), idx(1, 1), idx(2, 1), idx(3, 1)];
    expect(comptageSur(pos, { dead: g, incertains: g }, { morts: [], vivants: [] })).toEqual({ dead: [], incertains: g, prouves: 0 });
    expect(comptageSur(pos, { dead: [p], incertains: [] }, { morts: [], vivants: [] }).dead).toEqual([p]);
  });

  describe('bornes', () => {
    it('enclos trop grand : pas de preuve tentée', () => {
      const { pos } = fromRows(POS.carre, 1);
      expect(enclos(pos, idx(2, 0))).toHaveLength(9); // 4 vides et 5 pierres
      expect(enclos(pos, idx(2, 0), 3)).toBeNull();
      // Une pierre noire au milieu de son grand territoire : enclos de plus de PREUVE.zoneMax points vides.
      expect(enclos(pos, idx(4, 4))).toBeNull();
    });

    it('délai écoulé ou budget épuisé : rien de prouvé, le doute reste', () => {
      const { pos } = fromRows(POS.carre, 1);
      const base = comptageAuto(pos, { seed: 7 });
      expect(trancherParPreuve(pos, base, { timeMs: -1 })).toEqual({ morts: [], vivants: [] });
      expect(trancherParPreuve(pos, base, { budget: 3 }).morts).toEqual([]);
      expect(comptageSur(pos, base, trancherParPreuve(pos, base, { budget: 3 })).incertains).toEqual(base.incertains);
    });

    it('mur adverse douteux : pas de preuve', () => {
      const { pos } = fromRows(POS.carre, 1);
      const base = comptageAuto(pos, { seed: 7 });
      // Le mur noir (D9) est lui-même incertain : on ne s'appuie pas dessus.
      const t = trancherParPreuve(pos, { dead: base.dead, incertains: [...base.incertains, idx(3, 0)] });
      expect(t.morts).toEqual([]);
    });

    it('la recherche reste rapide sur toutes les positions de référence', () => {
      for (const { rows } of CAS) {
        const { pos } = fromRows(rows, 1);
        const t0 = performance.now();
        trancherParPreuve(pos, comptageAuto(pos, { seed: 7 }));
        // Délai global plus deux recherches bornées au pire ; large marge pour une CI lente.
        expect(performance.now() - t0).toBeLessThan(PREUVE.timeMs + 2500);
      }
    });
  });

  it('proposeComptage({ sur }) : la preuve tranche aussi sans Worker', async () => {
    const { pos } = fromRows(POS.carre, 1);
    const sur = await proposeComptage(pos, 6.5, { sur: true });
    expect(sur.incertains).toEqual([]);
    expect(sur.dead).toEqual([idx(2, 0), idx(2, 1), idx(0, 2), idx(1, 2), idx(2, 2)]);
    expect(sur.prouves).toBe(1);
    // Sans `sur` (4e partie et suivantes) : le comportement d'avant, groupe incertain renvoyé au joueur.
    const avant = await proposeComptage(pos, 6.5);
    expect(avant.incertains.length).toBeGreaterThan(0);
  });
});
