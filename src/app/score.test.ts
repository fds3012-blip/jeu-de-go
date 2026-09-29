import { afterEach, describe, expect, it } from 'vitest';
import { ARRIVEE_JETON, campsRecit, DUREE_CARRE, DUREE_RECIT, etatRecit, jetonsEtape, ligneCompteur, ligneDeuxieme, ligneKomi, ligneResultat, ligneTerritoire, PAUSE_LECTURE, recitScore, TEMPS, totauxEtapes } from './score';
import { choisirLangue } from '../content/i18n';
import { score } from '../go/score';
import { fromRows } from '../go/position';

describe('camps du récit (#118)', () => {
  const r = (gagnant: 0 | 1 | 2, marge: number) => ({ ...recitScore(fromRows(['.....', '.....', '.....', '.....', '.....']).pos, 6.5), gagnant, marge });
  it("contre l'ordi : « Toi » et le nom de l'adversaire", () => {
    expect(campsRecit('Pomme')).toEqual({ noir: 'Toi', blanc: 'Pomme', toi: true });
    expect(ligneResultat(r(1, 3.5), campsRecit('Pomme'))).toBe('Tu gagnes de 3,5 points !');
    expect(ligneResultat(r(2, 2.5), campsRecit('Pomme'))).toBe('Pomme gagne de 2,5 points');
    expect(ligneKomi(6.5, campsRecit('Pomme'))).toBe('+ 6,5 komi pour Pomme');
    const d = { ...r(1, 1), deuxieme: { type: 'prisonniers' as const, noir: 3, blanc: 1 } };
    expect(ligneDeuxieme(d, campsRecit('Pomme'))).toBe('+ 3 prisonniers pour toi, + 1 pour Pomme');
  });
  it('à deux : Noir et Blanc', () => {
    expect(campsRecit()).toEqual({ noir: 'Noir', blanc: 'Blanc', toi: false });
    expect(ligneResultat(r(1, 3.5), campsRecit())).toBe('Noir gagne de 3,5 points');
    expect(ligneResultat(r(0, 0), campsRecit('Pomme'))).toBe('Égalité');
  });
});

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

// Suite de #78 : chaque temps écrit son total, les prisonniers et le komi « rejoignent leur camp » (jetons).
describe('trois temps, trois totaux (#78)', () => {
  afterEach(() => choisirLangue('fr'));

  // Tirage pseudo-aléatoire reproductible : plateaux quelconques, captures et pierres mortes au hasard.
  function tirage(graine: number) {
    let x = graine;
    const hasard = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    const n = [9, 13, 19][graine % 3];
    const lignes = Array.from({ length: n }, () => Array.from({ length: n }, () => { const h = hasard(); return h < .25 ? 'X' : h < .5 ? 'O' : '.'; }).join(''));
    const { pos: p } = fromRows(lignes);
    p.captures = [0, Math.floor(hasard() * 12), Math.floor(hasard() * 12)];
    const morts = new Set<number>();
    for (let q = 0; q < p.board.length; q++) if (p.board[q] && hasard() < .05) morts.add(q);
    return { p, morts };
  }

  for (const [rules, komi] of [['japanese', 6.5], ['chinese', 7.5], ['japanese', 0], ['chinese', -3]] as const) {
    it(`${rules}, komi ${komi} : le total de chaque temps mène au score de src/go (60 plateaux)`, () => {
      for (let g = 1; g <= 60; g++) {
        const { p, morts } = tirage(g * 7919);
        const r = recitScore(p, komi, rules, morts), sc = score(p, komi, rules, morts);
        const [t1, t2, t3] = totauxEtapes(r);
        expect(t1).toEqual({ noir: sc.territory[1], blanc: sc.territory[2] });
        expect(t3).toEqual({ noir: sc.black, blanc: sc.white });
        expect(t2.noir).toBe(t3.noir);
        expect(t2.blanc + komi).toBe(t3.blanc);
        // Ce qu'affiche le récit à la fin de chaque temps est ce total-là.
        expect(etatRecit(r, TEMPS.prisonniers - 1)).toEqual({ etape: 1, ...t1 });
        expect(etatRecit(r, TEMPS.komi - 1)).toEqual({ etape: 2, ...t2 });
        expect(etatRecit(r, TEMPS.resultat - 1)).toEqual({ etape: 3, ...t3 });
        expect(etatRecit(r, DUREE_RECIT)).toEqual({ etape: 4, ...t3 });
        // Les jetons ajoutés aux totaux donnent le temps suivant.
        const j2 = jetonsEtape(r, 2), j3 = jetonsEtape(r, 3);
        expect({ noir: t1.noir + j2.noir, blanc: t1.blanc + j2.blanc }).toEqual(t2);
        expect({ noir: t2.noir + j3.noir, blanc: t2.blanc + j3.blanc }).toEqual(t3);
      }
    });
  }

  it('le chiffre change quand le jeton arrive dans le camp, pas avant', () => {
    const r = recitScore(pos, 6.5, 'japanese', dead);
    expect(etatRecit(r, TEMPS.prisonniers)).toEqual({ etape: 2, noir: 10, blanc: 5 });
    expect(etatRecit(r, TEMPS.prisonniers + ARRIVEE_JETON)).toEqual({ etape: 2, noir: 13, blanc: 6 });
    expect(etatRecit(r, TEMPS.komi)).toEqual({ etape: 3, noir: 13, blanc: 6 });
    expect(etatRecit(r, TEMPS.komi + ARRIVEE_JETON)).toEqual({ etape: 3, noir: 13, blanc: 12.5 });
    expect(jetonsEtape(r, 1)).toEqual({ noir: 0, blanc: 0 });
    expect(jetonsEtape(r, 4)).toEqual({ noir: 0, blanc: 0 });
    expect(TEMPS.komi + ARRIVEE_JETON).toBeLessThan(TEMPS.resultat);
  });

  it('tout, pause de lecture comprise, tient en moins de 4 s', () => {
    expect(DUREE_RECIT + PAUSE_LECTURE).toBeLessThan(4000);
  });

  it('ligne des territoires : chaque camp, son nombre', () => {
    const r = recitScore(pos, 6.5, 'japanese', dead);
    expect(ligneTerritoire(r)).toBe('10 points de territoire pour Noir, 5 pour Blanc');
    expect(ligneTerritoire(r, campsRecit('Pomme'))).toBe('10 points de territoire pour toi, 5 pour Pomme');
    expect(ligneTerritoire({ ...r, territoireBlanc: 0, territoireNoir: 1 })).toBe('1 point de territoire pour Noir');
    expect(ligneTerritoire({ ...r, territoireNoir: 0 }, campsRecit('Pomme'))).toBe('5 points de territoire pour Pomme');
    expect(ligneTerritoire({ ...r, territoireNoir: 0, territoireBlanc: 0 })).toBe('Aucun territoire');
  });

  it('en anglais', () => {
    choisirLangue('en');
    const r = recitScore(pos, 6.5, 'japanese', dead);
    expect(ligneTerritoire(r)).toBe('10 points of territory for Black, 5 for White');
    expect(ligneTerritoire(r, campsRecit('Pomme'))).toBe('10 points of territory for you, 5 for Pomme');
    expect(ligneTerritoire({ ...r, territoireBlanc: 0, territoireNoir: 1 })).toBe('1 point of territory for Black');
    expect(ligneDeuxieme(r)).toBe('+ 3 prisoners for Black, + 1 for White');
    expect(ligneKomi(6.5)).toBe('+ 6.5 komi for White');
  });
});
