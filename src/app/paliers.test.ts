import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES, BASE_PUZZLES, PUZZLES_16 } from '../content/puzzles';
import { PALIERS, aContinuer, aSuivre, auHasard, indexPalier, ordrePaliers, palierEnCours, palierRecommande, paliers, paliersVisibles, prochain, suivantPalier } from './paliers';

describe('problèmes sans fin (#147)', () => {
  const liste = [pbx('a', 300), pbx('b', 350), pbx('c', 400), pbx('n', 500)];
  const tous = new Set(liste.map(p => p.id));
  it("Continuer propose d'abord le prochain non résolu", () => {
    const r = new Set(['a']);
    expect(aContinuer(paliers(liste, r), r)?.id).toBe('b');
  });
  it('tout réussi : Continuer propose toujours un problème, jamais le dernier joué', () => {
    const ps = paliers(liste, tous);
    for (let k = 0; k < 20; k++) {
      const p = aContinuer(ps, tous, 'a', () => k / 20);
      expect(p).toBeDefined();
      expect(p?.id).not.toBe('a');
    }
  });
  it("tout réussi : Problème suivant n'est jamais le même deux fois de suite", () => {
    const ps = paliers(liste, tous);
    for (const c of liste) for (const x of [0, 0.5, 0.999]) {
      const p = aSuivre(ps, c, tous, () => x);
      expect(p).toBeDefined();
      expect(p?.id).not.toBe(c.id);
    }
  });
  it('ne tire que dans les paliers ouverts', () => {
    const ps = paliers([pbx('a', 300), pbx('z', 700)], new Set<string>());
    expect(auHasard(ps, undefined, () => 0.99)?.id).toBe('a');
  });
  it('un seul problème : il est reproposé plutôt que rien', () => {
    const one = [pbx('a', 300)];
    const r = new Set(['a']);
    expect(aSuivre(paliers(one, r), one[0], r)?.id).toBe('a');
  });
});

function pbx(id: string, difficulty: number) { return { id, difficulty }; }

const pb = (id: string, difficulty: number) => ({ id, difficulty });
const LISTE = [
  pb('a1', 400), pb('a2', 420), pb('a3', 440),
  pb('b1', 450), pb('b2', 500), pb('b3', 550), pb('b4', 640),
  pb('c1', 650), pb('c2', 800),
  pb('d1', 850), pb('d2', 1049),
  pb('e1', 1050), pb('e2', 1300)
];

describe('paliers', () => {
  it('range chaque difficulté dans son palier, bornes comprises', () => {
    expect(indexPalier(0)).toBe(0);
    expect(indexPalier(449)).toBe(0);
    expect(indexPalier(450)).toBe(1);
    expect(indexPalier(649)).toBe(1);
    expect(indexPalier(650)).toBe(2);
    expect(indexPalier(849)).toBe(2);
    expect(indexPalier(850)).toBe(3);
    expect(indexPalier(1049)).toBe(3);
    expect(indexPalier(1050)).toBe(4);
    expect(indexPalier(3000)).toBe(4);
  });

  it('avec les 18 problèmes de base, les 4 premiers paliers ne sont pas vides', () => {
    const ps = paliers([...BASE_PUZZLES, ...PUZZLES_16], new Set());
    expect(ps.slice(0, 4).every(p => p.total > 0)).toBe(true);
    expect(ps.reduce((n, p) => n + p.total, 0)).toBe(18);
    expect(ps.map(p => p.nom)).toEqual(['Débutant', 'Novice', 'Apprenti', 'Joueur de club', 'Confirmé']);
  });

  it('tous les problèmes, lots compris, sont dans un palier et un seul', () => {
    const ps = paliers(ALL_PUZZLES, new Set());
    expect(ordrePaliers(ps).length).toBe(ALL_PUZZLES.length);
    expect(new Set(ordrePaliers(ps).map(p => p.id)).size).toBe(ALL_PUZZLES.length);
    expect(ps.slice(0, 4).every(p => p.total > 0)).toBe(true);
  });

  it('compte les réussis et ouvre un palier à 60 % du précédent', () => {
    let ps = paliers(LISTE, new Set(['a1']));
    expect(ps[0]).toMatchObject({ reussis: 1, total: 3, ouvert: true, complet: false });
    expect(ps.map(p => p.ouvert)).toEqual([true, false, false, false, false]);
    ps = paliers(LISTE, new Set(['a1', 'a2'])); // 2 / 3 = 67 %
    expect(ps.map(p => p.ouvert)).toEqual([true, true, false, false, false]);
    ps = paliers(LISTE, new Set(['a1', 'a2', 'a3', 'b1', 'b2'])); // 2 / 4 = 50 % : Apprenti reste fermé
    expect(ps[0].complet).toBe(true);
    expect(ps.map(p => p.ouvert)).toEqual([true, true, false, false, false]);
    ps = paliers(LISTE, new Set(['a1', 'a2', 'b1', 'b2', 'b3'])); // 3 / 4 = 75 %
    expect(ps[2].ouvert).toBe(true);
  });

  it('un palier fermé ferme tous les suivants, même réussis', () => {
    const ps = paliers(LISTE, new Set(['c1', 'c2', 'd1', 'd2']));
    expect(ps.map(p => p.ouvert)).toEqual([true, false, false, false, false]);
  });

  it('un palier vide ne bloque pas le suivant', () => {
    const ps = paliers([pb('a', 400), pb('e', 1100)], new Set(['a']));
    expect(ps.map(p => p.total)).toEqual([1, 0, 0, 0, 1]);
    expect(ps[4].ouvert).toBe(true);
    expect(ps[1].complet).toBe(false);
  });

  it('prochain : le premier non réussi du palier ouvert le plus avancé', () => {
    expect(prochain(paliers(LISTE, new Set()), new Set())?.id).toBe('a1');
    const r = new Set(['a1', 'a3']);
    expect(prochain(paliers(LISTE, r), r)?.id).toBe('b1');
    const r2 = new Set(['a1', 'a3', 'b1', 'b2', 'b3', 'b4']);
    expect(prochain(paliers(LISTE, r2), r2)?.id).toBe('c1');
  });

  it('prochain : revient en arrière si le palier le plus avancé est fini, rien si tout est fait', () => {
    const r = new Set(['a1', 'a2', 'b1', 'b2', 'b3', 'b4', 'c1', 'c2', 'd1', 'd2', 'e1', 'e2']);
    expect(prochain(paliers(LISTE, r), r)?.id).toBe('a3');
    const tout = new Set(LISTE.map(p => p.id));
    expect(prochain(paliers(LISTE, tout), tout)).toBeUndefined();
  });

  it('suivant : suit l’ordre des paliers ouverts', () => {
    const r = new Set(['a1', 'a2']);
    const ps = paliers(LISTE, r);
    expect(suivantPalier(ps, LISTE[2], r)?.id).toBe('b1');
    expect(suivantPalier(ps, LISTE[6], r)?.id).toBe('a3'); // fin des paliers ouverts : on revient au début
    const r2 = new Set(['a1']);
    expect(suivantPalier(paliers(LISTE, r2), LISTE[2], r2)?.id).toBe('a2'); // Novice fermé
  });

  it('recommande le palier de la cote, sans dépasser le dernier ouvert', () => {
    const tout = new Set(LISTE.map(p => p.id));
    expect(palierRecommande(paliers(LISTE, tout), 700)).toBe('apprenti');
    expect(palierRecommande(paliers(LISTE, tout), 1500)).toBe('confirme');
    expect(palierRecommande(paliers(LISTE, new Set()), 1500)).toBe('debutant');
    expect(palierRecommande(paliers(LISTE, tout), undefined)).toBeUndefined();
    expect(PALIERS).toHaveLength(5);
  });
});

describe('un écran, une action (#196)', () => {
  const liste = [pbx('a', 300), pbx('b', 350), pbx('n1', 500), pbx('n2', 550), pbx('x', 700), pbx('y', 900)];
  it('palier en cours : le premier palier au départ', () => {
    expect(palierEnCours(paliers(liste, new Set()))?.id).toBe('debutant');
  });
  it('palier en cours : le plus avancé des ouverts, tant qu’il reste à finir', () => {
    expect(palierEnCours(paliers(liste, new Set(['a', 'b'])))?.id).toBe('novice');
    expect(palierEnCours(paliers(liste, new Set(['a', 'b', 'n1'])))?.id).toBe('novice');
    expect(palierEnCours(paliers(liste, new Set(['a', 'b', 'n1', 'n2'])))?.id).toBe('apprenti');
  });
  it('palier en cours : tout réussi, le dernier ouvert (jamais rien)', () => {
    const r = new Set(liste.map(p => p.id));
    expect(palierEnCours(paliers(liste, r))?.id).toBe('club');
  });
  it('liste complète : les paliers ouverts et un seul palier fermé, sans les vides', () => {
    const v = paliersVisibles(paliers(liste, new Set()));
    expect(v.ouverts.map(p => p.id)).toEqual(['debutant']);
    expect(v.prochain?.id).toBe('novice');
    const tout = paliersVisibles(paliers(liste, new Set(liste.map(p => p.id))));
    expect(tout.ouverts.map(p => p.id)).toEqual(['debutant', 'novice', 'apprenti', 'club']);
    expect(tout.prochain).toBeUndefined();
  });
});
