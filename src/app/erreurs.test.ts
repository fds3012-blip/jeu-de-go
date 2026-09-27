import { describe, expect, it } from 'vitest';
import { fromRows } from '../go/position';
import { fromLabel } from '../go/coords';
import { checkAnswer } from '../data/puzzles';
import {
  ajouter, apresEssai, aRejouer, consigneErreur, creerErreur, equivalents, jour, lendemain, lireErreurs, MAX_ERREURS,
  peutEnFaireUnProbleme, rangees, titreErreur, versProbleme, type ErreurGardee, type Source,
} from './erreurs';

// Position de partie réelle (9 × 9, ouverture) : Noir au trait.
const ROWS = [
  '.........',
  '.........',
  '..O...X..',
  '.........',
  '....X....',
  '.........',
  '..X...O..',
  '.........',
  '.........',
];
const avant = fromRows(ROWS, 1).pos;
const at = (l: string) => fromLabel(l, 9);
const MAINTENANT = new Date(2026, 8, 27, 18, 0);

const analyse = {
  lead: 2, engine: 'katago' as const,
  coups: [
    { move: at('C4'), visits: 40, lead: 3 },
    { move: at('G4'), visits: 20, lead: 2.7 },
    { move: at('D7'), visits: 12, lead: 2.6 },
    { move: at('E7'), visits: 10, lead: 1.2 },
    { move: at('B8'), visits: 3, lead: 2.9 },
  ],
};

const source = (s: Partial<Source> = {}): Source => ({
  avant, joue: at('A1'), coup: 14, note: 'erreur', meilleur: at('C4'), perte: 4, analyse, adversaire: 'Pomme', ...s,
});

describe('création du problème', () => {
  it('garde la position avant le coup, la couleur à jouer et le meilleur coup en premier', () => {
    const e = creerErreur(source(), MAINTENANT)!;
    expect(e).not.toBeNull();
    expect(e.rows).toEqual(ROWS);
    expect(rangees(avant)).toEqual(ROWS);
    expect(e.toPlay).toBe(1);
    expect(e.reponses[0]).toBe(at('C4'));
    expect(e.prochain).toBe('2026-09-27');
    expect(titreErreur(e)).toBe('Ta partie contre Pomme, coup 14');
  });

  it('accepte les coups équivalents à 0,5 point près, avec assez de visites', () => {
    const e = creerErreur(source(), MAINTENANT)!;
    expect(e.reponses).toEqual([at('C4'), at('G4'), at('D7')]);
    expect(consigneErreur(e)).toBe('Trouve mieux que ton coup.');
    const pz = versProbleme(e);
    expect(checkAnswer(pz, at('G4')).kind).toBe('ok');
    expect(checkAnswer(pz, at('E7')).kind).toBe('wrong'); // 1,8 point de moins
    expect(checkAnswer(pz, at('B8')).kind).toBe('wrong'); // trop peu de visites
  });

  it("sans analyse utilisable, seul le coup de KataGo est accepté et le texte le dit", () => {
    for (const a of [null, { lead: 2, engine: 'simple' as const }, { ...analyse, coups: analyse.coups.filter(c => c.move !== at('C4')) }]) {
      const e = creerErreur(source({ analyse: a }), MAINTENANT)!;
      expect(e.reponses).toEqual([at('C4')]);
      expect(consigneErreur(e)).toContain('le coup de KataGo');
      expect(versProbleme(e).explanation).toBe('Bravo, c’est le coup de KataGo !');
    }
  });

  it('écarte un équivalent sur la première ligne quand le plateau est encore ouvert', () => {
    const a = { ...analyse, coups: [...analyse.coups.slice(0, 1), { move: at('A5'), visits: 30, lead: 2.9 }] };
    expect(equivalents(avant, at('C4'), a, at('A1'), 4)).toEqual([]);
  });

  it('partie à deux : titre sans adversaire', () => {
    expect(titreErreur({ coup: 3 })).toBe('Ta partie à deux, coup 3');
  });
});

describe('filtrage sur le conseil fiable', () => {
  it('seulement Erreur ou Grosse erreur, avec un meilleur coup fiable', () => {
    expect(peutEnFaireUnProbleme('erreur', 3)).toBe(true);
    expect(peutEnFaireUnProbleme('grosse', 3)).toBe(true);
    expect(peutEnFaireUnProbleme('imprecision', 3)).toBe(false);
    expect(peutEnFaireUnProbleme('bon', 3)).toBe(false);
    expect(peutEnFaireUnProbleme('erreur', null)).toBe(false);
    expect(peutEnFaireUnProbleme('grosse', undefined)).toBe(false);
    expect(peutEnFaireUnProbleme('erreur', -1)).toBe(false);
  });

  it('sans conseil fiable, aucun problème', () => {
    expect(creerErreur(source({ meilleur: null }), MAINTENANT)).toBeNull();
    expect(creerErreur(source({ note: 'imprecision' }), MAINTENANT)).toBeNull();
    expect(creerErreur(source({ avant: fromRows(Array(7).fill('.......'), 1).pos }), MAINTENANT)).toBeNull();
  });
});

describe('liste et répétition espacée', () => {
  const e = (i: number): ErreurGardee => ({ ...creerErreur(source(), new Date(2026, 0, 1, 0, i))!, id: `e${i}` });

  it('au plus 30 problèmes, les plus anciens remplacés en premier', () => {
    let l: ErreurGardee[] = [];
    for (let i = 0; i < MAX_ERREURS + 5; i++) l = ajouter(l, e(i));
    expect(l).toHaveLength(MAX_ERREURS);
    expect(l[0].id).toBe('e5');
    expect(l[l.length - 1].id).toBe(`e${MAX_ERREURS + 4}`);
  });

  it('la même position ne compte qu’une fois', () => {
    const a = creerErreur(source(), MAINTENANT)!, b = creerErreur(source({ coup: 20 }), MAINTENANT)!;
    expect(ajouter(ajouter([], a), b)).toEqual([b]);
  });

  it('réussi : il sort de la liste ; raté : il revient le lendemain', () => {
    const l = [e(1), e(2)];
    expect(aRejouer(l, MAINTENANT)).toHaveLength(2);
    expect(apresEssai(l, 'e1', true, MAINTENANT).map(x => x.id)).toEqual(['e2']);
    const r = apresEssai(l, 'e1', false, MAINTENANT);
    expect(r[0].prochain).toBe('2026-09-28');
    expect(r[0].rates).toBe(1);
    expect(aRejouer(r, MAINTENANT).map(x => x.id)).toEqual(['e2']);
    expect(aRejouer(r, new Date(2026, 8, 28, 0, 5)).map(x => x.id)).toEqual(['e1', 'e2']);
  });

  it('jours locaux, fin de mois comprise', () => {
    expect(jour(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(lendemain(new Date(2026, 8, 30, 23, 59))).toBe('2026-10-01');
  });

  it('relit le stockage en écartant ce qui est mal formé', () => {
    expect(lireErreurs(null)).toEqual([]);
    expect(lireErreurs([e(1), { id: 'x' }, { ...e(2), reponses: [] }]).map(x => x.id)).toEqual(['e1']);
  });
});
