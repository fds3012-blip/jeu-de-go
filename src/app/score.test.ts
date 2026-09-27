import { describe, expect, it } from 'vitest';
import { DUREE_CARRE, DUREE_RECIT, etatRecit, ligneCompteur, ligneDeuxieme, ligneKomi, ligneResultat, recitScore, TEMPS } from './score';
import { score } from '../go/score';
import { fromRows } from '../go/position';

// Partie 5 × 5 : Noir tient la gauche, Blanc la droite ; une pierre blanche morte (T) dans le camp noir.
const { pos, marked } = fromRows([
  '..XO.',
  '.TXO.',
  '..XO.',
  '..XO.',
  '..XO.',
]);
pos.captures = [0, 2, 1];
const dead = new Set(marked);

describe('récit du score (#78)', () => {
  for (const [rules, komi] of [['japanese', 6.5], ['chinese', 7.5]] as const) {
    it(`${rules} : les totaux du récit sont ceux de src/go/score`, () => {
      const r = recitScore(pos, komi, rules, dead), sc = score(pos, komi, rules, dead);
      expect(r.noir).toBe(sc.black);
      expect(r.blanc).toBe(sc.white);
      expect(r.territoireNoir + r.deuxieme.noir).toBe(sc.black);
      expect(r.territoireBlanc + r.deuxieme.blanc + komi).toBe(sc.white);
      expect(r.territoire.length).toBe(sc.territory[1] + sc.territory[2]);
      expect(r.marge).toBe(sc.margin);
      expect(r.gagnant).toBe(sc.winner);
      expect(etatRecit(r, DUREE_RECIT)).toEqual({ etape: 4, noir: sc.black, blanc: sc.white });
    });
  }

  it('japonais : les prisonniers comptent les captures et les pierres mortes', () => {
    const r = recitScore(pos, 6.5, 'japanese', dead);
    // Territoire noir : 2 colonnes de 5, la pierre morte retirée compte comme territoire.
    expect(r.territoireNoir).toBe(10);
    expect(r.territoireBlanc).toBe(5);
    expect(r.deuxieme).toEqual({ type: 'prisonniers', noir: 3, blanc: 1 });
    expect(ligneDeuxieme(r)).toBe('+ 3 prisonniers pour Noir, + 1 pour Blanc');
    expect(ligneResultat(r)).toBe('Noir gagne de 0,5 point');
  });

  it('les étapes se suivent et les compteurs ne redescendent jamais', () => {
    const r = recitScore(pos, 6.5, 'japanese', dead);
    let avant = { etape: 0, noir: 0, blanc: 0 };
    for (let t = 0; t <= DUREE_RECIT; t += 10) {
      const e = etatRecit(r, t);
      expect(e.etape).toBeGreaterThanOrEqual(avant.etape);
      expect(e.noir).toBeGreaterThanOrEqual(avant.noir);
      expect(e.blanc).toBeGreaterThanOrEqual(avant.blanc);
      avant = e;
    }
    expect(etatRecit(r, TEMPS.prisonniers - 1)).toEqual({ etape: 1, noir: 10, blanc: 5 });
    expect(etatRecit(r, TEMPS.komi - 1)).toEqual({ etape: 2, noir: 13, blanc: 6 });
    expect(etatRecit(r, TEMPS.resultat - 1)).toEqual({ etape: 3, noir: 13, blanc: 12.5 });
  });

  it('tout tient en 2,5 s, même sur un 19 × 19 plein de territoire', () => {
    const grand = fromRows(Array.from({ length: 19 }, (_, y) => (y === 9 ? 'X'.repeat(19) : '.'.repeat(19)))).pos;
    const r = recitScore(grand, 6.5);
    expect(r.territoire.length).toBe(19 * 18);
    const dernier = Math.max(...r.territoire.map(q => q.delai));
    expect(dernier + DUREE_CARRE).toBeLessThanOrEqual(TEMPS.prisonniers);
    expect(TEMPS.resultat).toBeLessThan(DUREE_RECIT);
    expect(DUREE_RECIT).toBeLessThanOrEqual(2500);
    // Les carrés apparaissent dans l'ordre de lecture.
    expect(r.territoire.map(q => q.p)).toEqual([...r.territoire.map(q => q.p)].sort((a, b) => a - b));
  });

  it('plateau vide : pas de territoire, Blanc gagne du komi', () => {
    const r = recitScore(fromRows(Array.from({ length: 9 }, () => '.'.repeat(9))).pos, 6.5);
    expect(r.territoire).toEqual([]);
    expect(ligneDeuxieme(r)).toBe('Aucun prisonnier');
    expect(ligneResultat(r)).toBe('Blanc gagne de 6,5 points');
    expect(etatRecit(r, 0)).toEqual({ etape: 1, noir: 0, blanc: 0 });
  });

  it('textes : komi, compteur, égalité', () => {
    expect(ligneKomi(6.5)).toBe('+ 6,5 komi pour Blanc');
    expect(ligneKomi(-100)).toBe('− 100 komi pour Blanc');
    expect(ligneCompteur(18, 12.5)).toBe('Noir 18 · Blanc 12,5');
    const vide = fromRows(Array.from({ length: 9 }, () => '.'.repeat(9))).pos;
    const r = recitScore(vide, 0);
    expect(r.gagnant).toBe(0);
    expect(ligneResultat(r)).toBe('Égalité');
  });
});
