import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { OPPONENTS } from '../engine';
import { COTE_DEPART, ETAT_INITIAL, nettoyerCote } from './coteJoueur';
import { echelle, OUVERTS_D_OFFICE } from './home';
import {
  adversaireConseille, bilanPlacement, chapitreConseille, choisirPlacement, cibleSuivante, coteApresPlacement, coteDePlacement,
  kyuDeCote, kyuDuRang, leconDeLAccueil, lirePlacement, NB_PROBLEMES, ouvertsApresPlacement, proposerPlacement, type Essai, type Placement,
} from './placement';

const PROBLEMES = parsePuzzles(ALL_PUZZLES);
const essai = (difficulte: number, ok: boolean, id = `p${difficulte}`): Essai => ({ id, difficulte, ok });

/** Joue le placement : `reponses[i]` dit si le i-e problème est réussi. */
function jouer(reponses: boolean[]) {
  const essais: Essai[] = [];
  for (const ok of reponses) {
    const p = choisirPlacement(PROBLEMES, essais)!;
    essais.push({ id: p.id, difficulte: p.difficulty, ok });
  }
  return essais;
}

describe('cote → kyu (table documentée dans placement.ts)', () => {
  it('la cote de départ d’un débutant vaut 25 kyu, puis un kyu tous les 55 points', () => {
    expect(kyuDeCote(COTE_DEPART)).toBe(25);
    expect(kyuDeCote(COTE_DEPART + 55)).toBe(24);
    expect(kyuDeCote(COTE_DEPART + 10 * 55)).toBe(15);
    expect(kyuDeCote(1060)).toBe(13);
  });

  it('bornée de 25 à 1 kyu, et jamais plus faible quand la cote monte', () => {
    expect(kyuDeCote(0)).toBe(25);
    expect(kyuDeCote(5000)).toBe(1);
    let avant = 25;
    for (let c = 0; c <= 3000; c += 10) { const k = kyuDeCote(c); expect(k).toBeLessThanOrEqual(avant); avant = k; }
  });

  it('lit le rang d’un adversaire ; un dan compte comme plus fort que 1 kyu', () => {
    expect(kyuDuRang('13 kyu')).toBe(13);
    expect(kyuDuRang('1 dan')).toBe(0);
  });
});

describe('logique adaptative', () => {
  it('commence vers 600, monte après une réussite, descend après un échec', () => {
    expect(cibleSuivante([])).toBe(600);
    expect(cibleSuivante([essai(600, true)])).toBe(900);
    expect(cibleSuivante([essai(600, false)])).toBe(400);
    expect(cibleSuivante([essai(600, true), essai(900, true)])).toBe(1250);
    expect(cibleSuivante([essai(600, true), essai(900, false)])).toBe(700);
    expect(cibleSuivante([essai(600, false), essai(400, true)])).toBe(750);
    expect(cibleSuivante([essai(600, false), essai(400, false)])).toBe(200);
  });

  it('tout réussi : trois problèmes de difficulté croissante, environ 600, 900 et 1 250', () => {
    const e = jouer([true, true, true]);
    expect(e).toHaveLength(NB_PROBLEMES);
    expect(e[0].difficulte).toBe(600);
    expect(e[1].difficulte).toBe(900);
    expect(e[2].difficulte).toBe(1250);
  });

  it('jamais deux fois le même problème, un 9 × 9 d’abord à égalité, choix stable', () => {
    const e = jouer([false, false, false]);
    expect(new Set(e.map(x => x.id)).size).toBe(3);
    const premier = choisirPlacement(PROBLEMES, [])!;
    expect(premier.size).toBe(9);
    expect(choisirPlacement(PROBLEMES, [])!.id).toBe(premier.id);
  });

  it('une réussite ne fait jamais baisser le niveau, un échec jamais monter', () => {
    const chemins = [0, 1, 2, 3, 4, 5, 6, 7].map(m => [0, 1, 2].map(i => !!(m & (1 << (2 - i)))));
    const kyu = (r: boolean[]) => bilanPlacement(jouer(r)).kyu ?? 99;
    for (const r of chemins) {
      for (let i = 0; i < 3; i++) {
        if (r[i]) continue;
        const mieux = r.map((x, j) => (j === i ? true : x));
        expect(kyu(mieux)).toBeLessThanOrEqual(kyu(r));
      }
    }
  });
});

describe('bilan du placement', () => {
  it('cote de performance : moyenne des difficultés ± 400 × (réussites − échecs) / 3', () => {
    expect(coteDePlacement([essai(600, true), essai(900, true), essai(1250, true)])).toBe(1317);
    expect(coteDePlacement([essai(600, true), essai(900, true), essai(1250, false)])).toBe(1050);
    expect(coteDePlacement([essai(600, true), essai(400, false), essai(300, false)])).toBe(COTE_DEPART);
  });

  it('tout réussi : environ 8 kyu, contre Renard (10 kyu)', () => {
    const b = bilanPlacement(jouer([true, true, true]));
    expect(b.kyu).toBe(8);
    expect(adversaireConseille(OPPONENTS, b.kyu!).id).toBe('renard');
  });

  it('tout raté : pas de kyu annoncé, la cote reste celle d’un débutant, la leçon 1', () => {
    const b = bilanPlacement(jouer([false, false, false]));
    expect(b).toEqual({ kyu: null, cote: COTE_DEPART });
    expect(chapitreConseille(b.kyu, 2)).toBe(0);
  });
});

describe('adversaire et chapitre conseillés', () => {
  it('le plus fort de l’échelle dont le rang n’est pas au-dessus du joueur', () => {
    expect(adversaireConseille(OPPONENTS, 25).id).toBe('pomme');
    expect(adversaireConseille(OPPONENTS, 20).id).toBe('pomme');
    expect(adversaireConseille(OPPONENTS, 17).id).toBe('pomme');
    expect(adversaireConseille(OPPONENTS, 15).id).toBe('caillou');
    expect(adversaireConseille(OPPONENTS, 13).id).toBe('bambou');
    expect(adversaireConseille(OPPONENTS, 8).id).toBe('renard');
    expect(adversaireConseille(OPPONENTS, 1).id).toBe('dragon');
  });

  it('les bases jusqu’à 18 kyu, le chapitre suivant ensuite', () => {
    expect(chapitreConseille(25, 2)).toBe(0);
    expect(chapitreConseille(18, 2)).toBe(0);
    expect(chapitreConseille(17, 2)).toBe(1);
    expect(chapitreConseille(8, 1)).toBe(0);
  });

  it('le placement ouvre l’échelle jusqu’à l’adversaire conseillé compris', () => {
    const fait: Placement = { fait: true, kyu: 13, cote: 1060, adversaire: 'bambou', date: '2026-09-29' };
    const n = ouvertsApresPlacement(OPPONENTS, fait, OUVERTS_D_OFFICE);
    expect(n).toBe(3);
    const e = echelle(OPPONENTS, {}, n);
    expect(e.find(x => x.adv.id === 'bambou')!.ouvert).toBe(true);
    expect(e.find(x => x.adv.id === 'renard')!.ouvert).toBe(false);
    expect(ouvertsApresPlacement(OPPONENTS, { fait: false, saute: true, date: '2026-09-29' }, OUVERTS_D_OFFICE)).toBe(OUVERTS_D_OFFICE);
  });
});

describe('stockage et accueil', () => {
  it('la cote de « Continuer à ta mesure » part du placement', () => {
    const e = coteApresPlacement(null, 1050);
    expect(e.cote).toBe(1050);
    expect(e.essais).toBe(NB_PROBLEMES);
    expect(nettoyerCote(e)).toEqual(e);
    expect(coteApresPlacement({ ...ETAT_INITIAL, essais: 20, serie: 4 }, 900)).toMatchObject({ cote: 900, essais: 20, serie: 0 });
  });

  it('relit un résultat gardé, ignore un résultat abîmé', () => {
    expect(lirePlacement(null)).toBeNull();
    expect(lirePlacement({ fait: true, kyu: 12 })).toBeNull();
    expect(lirePlacement({ fait: true, kyu: 99, cote: 400, adversaire: 'pomme', date: 'x' })).toMatchObject({ kyu: null });
    expect(lirePlacement({ fait: false, saute: true, date: '2026-09-29' })).toEqual({ fait: false, saute: true, date: '2026-09-29' });
  });

  it('le lien « Je sais déjà jouer » : au premier lancement seulement, tant que rien n’est décidé', () => {
    expect(proposerPlacement(0, null)).toBe(true);
    expect(proposerPlacement(1, null)).toBe(false);
    expect(proposerPlacement(0, { fait: false, saute: true, date: '2026-09-29' })).toBe(false);
    expect(proposerPlacement(0, null, 1)).toBe(false);
  });
});

// #308 : après le placement, la carte « Leçon » de l'accueil suit le chapitre conseillé, pas la leçon 1.
describe('leçon proposée sur l’accueil', () => {
  const l = (id: string) => ({ id, steps: [1, 2] });
  const lecons = [l('l1'), l('l2'), l('l8')];
  const chapitres = [{ lecons: lecons.slice(0, 2) }, { lecons: lecons.slice(2) }];
  const place = (kyu: number | null): Placement => ({ fait: true, kyu, cote: 1400, adversaire: 'renard', date: '2026-09-29' });

  it('sans placement, ou placement passé : la première leçon pas finie', () => {
    expect(leconDeLAccueil(lecons, chapitres, {}, null)?.id).toBe('l1');
    expect(leconDeLAccueil(lecons, chapitres, { l1: 2 }, { fait: false, saute: true, date: '2026-09-29' })?.id).toBe('l2');
  });

  it('placé à 8 kyu : le chapitre conseillé, pas la leçon 1', () => {
    expect(leconDeLAccueil(lecons, chapitres, {}, place(8))?.id).toBe('l8');
  });

  it('placé mais tout raté (pas de kyu) ou 20 kyu : les bases', () => {
    expect(leconDeLAccueil(lecons, chapitres, {}, place(null))?.id).toBe('l1');
    expect(leconDeLAccueil(lecons, chapitres, {}, place(20))?.id).toBe('l1');
  });

  it('chapitre conseillé fini : aucune leçon, le Go du jour reste seul', () => {
    expect(leconDeLAccueil(lecons, chapitres, { l8: 2 }, place(8))).toBeUndefined();
  });
});
