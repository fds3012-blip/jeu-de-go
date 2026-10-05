// Image du moment clé (#364) : phrase du résultat, coupure des lignes, et dessin sur un faux canvas (aucune donnée
// personnelle au-delà des noms donnés : ni date, ni identifiant).
import { describe, expect, it } from 'vitest';
import { couper, dessinerImage, HAUTEUR, LARGEUR, texteResultat } from './imagePartie';

describe('résultat en clair', () => {
  it('français et anglais', () => {
    expect(texteResultat('B+6.5', 'fr')).toBe('Noir gagne de 6,5 points');
    expect(texteResultat('W+0.5', 'fr')).toBe('Blanc gagne de 0,5 point');
    expect(texteResultat('W+R', 'fr')).toBe('Blanc gagne par abandon');
    expect(texteResultat('B+T', 'en')).toBe('Black wins on time');
    expect(texteResultat('B+12.5', 'en')).toBe('Black wins by 12.5 points');
    expect(texteResultat('B+1.5', 'fr')).toBe('Noir gagne de 1,5 point');
    expect(texteResultat('B+1.5', 'en')).toBe('Black wins by 1.5 points');
    expect(texteResultat('B+2', 'fr')).toBe('Noir gagne de 2 points');
    expect(texteResultat('0', 'fr')).toBe('Égalité');
    expect(texteResultat(undefined, 'fr')).toBe('Partie non finie');
  });
});

describe('coupure des lignes', () => {
  const mesure = (s: string) => s.length * 10;
  it('coupe aux espaces, abrège la dernière ligne', () => {
    expect(couper(mesure, 'Noir gagne de 6,5 points', 140)).toEqual(['Noir gagne de', '6,5 points']);
    expect(couper(mesure, 'un deux trois quatre cinq six sept', 100, 2)).toEqual(['un deux', 'trois…']);
    expect(couper(mesure, 'court', 100)).toEqual(['court']);
  });
});

describe('dessin', () => {
  it('dessine le plateau, les pierres, le dernier coup et les textes, sans autre donnée', () => {
    const textes: string[] = [];
    const arcs: number[] = [];
    const degrade = { addColorStop: () => {} };
    const ctx = new Proxy({} as Record<string, unknown>, {
      get(cible, cle: string) {
        if (cle in cible) return cible[cle];
        if (cle === 'fillText') return (t: string) => { textes.push(t); };
        if (cle === 'measureText') return (t: string) => ({ width: t.length * 20 });
        if (cle === 'arc') return (x: number) => { arcs.push(x); };
        if (cle.startsWith('create')) return () => degrade;
        return () => {};
      },
      set(cible, cle: string, v) { cible[cle] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const board = new Array(81).fill(0);
    board[40] = 1; board[41] = 2;
    dessinerImage(ctx, { size: 9, board, dernier: 41, coup: 12, resultat: 'B+6.5', noir: 'Ana', blanc: 'Tigre', langue: 'fr' });
    expect(textes).toEqual(expect.arrayContaining(['Mochi Go', 'Moment clé · coup 12', 'Ana', 'Tigre', 'Joue au go sur mochi-go.app']));
    expect(textes.join(' ')).toContain('Noir gagne');
    expect(textes.join(' ')).not.toMatch(/\d{4}-\d{2}|@/);
    expect(arcs.length).toBeGreaterThan(10);
    expect([LARGEUR, HAUTEUR]).toEqual([1200, 630]);
  });
});
