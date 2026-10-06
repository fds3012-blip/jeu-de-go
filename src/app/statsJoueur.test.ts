import { describe, expect, it } from 'vitest';
import {
  ajouterRevue, bilanDe, bornesCourbe, empreinte, erreursMoyennes, erreursParPhaseDe, finOuverture, lireRevue, lireRevues, partGagnee,
  phaseDuCoup, phaseFaible, precisionMoyenne, type RevueGardee,
} from './statsJoueur';
import type { PartieHistorique } from './historique';

// #368 (recadrée après #417) : statistiques du joueur de club, tirées des revues avec KataGo et des parties.
const revue = (cle: string, precision: number, erreurs: [number, number, number] = [0, 0, 0]): RevueGardee =>
  ({ cle, date: '2026-10-05T10:00:00.000Z', taille: 9, precision, erreurs });

describe('phases d’une partie', () => {
  it('ouverture d’environ un septième des intersections', () => {
    expect([finOuverture(9), finOuverture(13), finOuverture(19)]).toEqual([12, 24, 52]);
  });
  it('ouverture, milieu, puis fin de partie dans le dernier quart', () => {
    expect(phaseDuCoup(1, 60, 9)).toBe('ouverture');
    expect(phaseDuCoup(12, 60, 9)).toBe('ouverture');
    expect(phaseDuCoup(13, 60, 9)).toBe('milieu');
    expect(phaseDuCoup(45, 60, 9)).toBe('milieu');
    expect(phaseDuCoup(46, 60, 9)).toBe('fin');
    expect(phaseDuCoup(60, 60, 9)).toBe('fin');
  });
  it('une partie courte n’a pas de fin de partie avant la fin de l’ouverture', () => {
    expect(phaseDuCoup(10, 14, 9)).toBe('ouverture');
    expect(phaseDuCoup(13, 14, 9)).toBe('fin');
  });
});

describe('erreurs par phase d’une revue', () => {
  it('compte seulement les erreurs du joueur (Erreur, Coup manqué, Gaffe)', () => {
    const notes = [
      { coup: 3, couleur: 1 as const, note: 'erreur' as const },
      { coup: 4, couleur: 2 as const, note: 'grosse' as const }, // l'adversaire : pas compté
      { coup: 20, couleur: 1 as const, note: 'manque' as const },
      { coup: 21, couleur: 1 as const, note: 'imprecision' as const }, // une imprécision n'est pas une erreur
      { coup: 55, couleur: 1 as const, note: 'grosse' as const },
      null,
    ];
    expect(erreursParPhaseDe(notes, 1, 60, 9)).toEqual([1, 1, 1]);
    expect(erreursParPhaseDe(notes, 2, 60, 9)).toEqual([1, 0, 0]);
  });
});

describe('revues gardées', () => {
  it('une partie revue deux fois ne compte qu’une fois, la plus récente en tête', () => {
    let l = ajouterRevue([], revue('a', 70));
    l = ajouterRevue(l, revue('b', 80));
    l = ajouterRevue(l, revue('a', 90));
    expect(l.map(r => [r.cle, r.precision])).toEqual([['a', 90], ['b', 80]]);
  });
  it('garde les 50 plus récentes', () => {
    let l: RevueGardee[] = [];
    for (let i = 0; i < 60; i++) l = ajouterRevue(l, revue(String(i), 50));
    expect(l).toHaveLength(50);
    expect(l[0].cle).toBe('59');
  });
  it('écarte les entrées abîmées', () => {
    expect(lireRevue(null)).toBeNull();
    expect(lireRevue({ ...revue('a', 50), precision: 120 })).toBeNull();
    expect(lireRevue({ ...revue('a', 50), taille: 7 })).toBeNull();
    expect(lireRevue({ ...revue('a', 50), erreurs: [1, 2] })).toBeNull();
    expect(lireRevue({ ...revue('a', 50), date: 'hier' })).toBeNull();
    expect(lireRevues([revue('a', 50), 'x', { cle: 1 }])).toHaveLength(1);
    expect(lireRevues('nimporte')).toEqual([]);
  });
  it('empreinte stable, différente pour deux parties', () => {
    expect(empreinte('(;SZ[9];B[ee])')).toBe(empreinte('(;SZ[9];B[ee])'));
    expect(empreinte('(;SZ[9];B[ee])')).not.toBe(empreinte('(;SZ[9];B[ef])'));
  });
});

describe('moyennes', () => {
  it('précision moyenne des 20 dernières revues, arrondie', () => {
    expect(precisionMoyenne([])).toBeNull();
    expect(precisionMoyenne([revue('a', 81), revue('b', 84)])).toEqual({ valeur: 83, parties: 2 });
    const l = Array.from({ length: 25 }, (_, i) => revue(String(i), i < 20 ? 90 : 10));
    expect(precisionMoyenne(l)).toEqual({ valeur: 90, parties: 20 });
  });
  it('erreurs moyennes par phase et phase faible', () => {
    const m = erreursMoyennes([revue('a', 80, [0, 3, 1]), revue('b', 80, [1, 2, 0])]);
    expect(m).toEqual({ ouverture: 0.5, milieu: 2.5, fin: 0.5, parties: 2 });
    expect(phaseFaible(m)).toBe('milieu');
    expect(phaseFaible({ ouverture: 0.2, milieu: 0.4, fin: 0 })).toBeNull(); // trop peu pour en parler
    expect(phaseFaible(null)).toBeNull();
  });
});

describe('bilan par taille et par mode', () => {
  const p = (o: Partial<PartieHistorique>): PartieHistorique => ({ id: Math.random().toString(36), date: '2026-10-01T10:00:00.000Z', sgf: '(;SZ[9])', mode: 'ordi', taille: 9, joueur: 1, ...o });
  it('compte victoires et défaites ; à deux, importées et égalités à part', () => {
    const b = bilanDe([
      p({ resultat: 'B+5.5' }), p({ resultat: 'W+R' }), p({ taille: 13, resultat: 'B+R' }),
      p({ mode: 'guidee', resultat: 'B+2.5' }), p({ mode: 'defi', joueur: 2, taille: 19, resultat: 'W+T' }),
      p({ mode: 'deux', joueur: null, resultat: 'B+3' }), p({ mode: 'import', resultat: 'B+3' }), p({ resultat: '0' }), p({}),
    ], [{ taille: 9, gagnee: true }, { taille: null, gagnee: false }]);
    expect(b.mode).toEqual({ ordi: { v: 2, d: 1 }, guidee: { v: 1, d: 0 }, defi: { v: 1, d: 0 }, enLigne: { v: 1, d: 1 } });
    expect(b.taille).toEqual({ 9: { v: 3, d: 1 }, 13: { v: 1, d: 0 }, 19: { v: 1, d: 0 } });
    expect(b.total).toBe(7);
  });
  it('part gagnée en pour cent', () => {
    expect(partGagnee({ v: 1, d: 2 })).toBe(33);
    expect(partGagnee({ v: 0, d: 0 })).toBeNull();
  });
});

describe('courbe de la cote', () => {
  it('au moins un grade de hauteur', () => {
    expect(bornesCourbe([1500, 1503])).toEqual({ bas: 1451.5, haut: 1551.5 });
    expect(bornesCourbe([1200, 1600])).toEqual({ bas: 1200, haut: 1600 });
  });
});
