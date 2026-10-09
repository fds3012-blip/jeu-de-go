import { describe, expect, it } from 'vitest';
import { fromRows } from '../go/position';
import { fromLabel, toLabel } from '../go/coords';
import { FLORIAN_APRES, FLORIAN_AVANT } from './florian497.fixture';
import { checkAnswer } from '../data/puzzles';
import {
  ajouter, apresEssai, aRejouer, consigneErreur, coupAccepte, creerErreur, dansJours, devientMaitrisee, equivalents, garderRatee,
  jour, lendemain, lireErreurs, MAX_ERREURS, peutEnFaireUnProbleme, rangees, titreErreur, versProbleme, type ErreurGardee, type Source,
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

  it('accepte les coups qui perdent moins de 1 point, avec assez de visites', () => {
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

  it('réussi une fois : il revient à J+3 ; raté : il revient le lendemain', () => {
    const l = [e(1), e(2)];
    expect(aRejouer(l, MAINTENANT)).toHaveLength(2);
    const ok = apresEssai(l, 'e1', true, MAINTENANT);
    expect(ok.map(x => x.id)).toEqual(['e1', 'e2']);
    expect(ok[0].prochain).toBe('2026-09-30');
    expect(ok[0].reussites).toBe(1);
    const r = apresEssai(l, 'e1', false, MAINTENANT);
    expect(r[0].prochain).toBe('2026-09-28');
    expect(r[0].rates).toBe(1);
    expect(aRejouer(r, MAINTENANT).map(x => x.id)).toEqual(['e2']);
    expect(aRejouer(r, new Date(2026, 8, 28, 0, 5)).map(x => x.id)).toEqual(['e1', 'e2']);
  });

  it('erreur ratée dans la revue (#469) : J+1, puis J+3, J+7, J+14, J+30 ; un échec renvoie à J+1', () => {
    const j0 = new Date(2026, 8, 28, 22, 0);
    let l = garderRatee([], e(1), j0);
    expect(l[0].prochain).toBe('2026-09-29');
    expect(l[0].rates).toBe(1);
    expect(l[0].maj).toBe(j0.getTime());
    expect(aRejouer(l, j0)).toEqual([]);
    // J+1 : ratée encore, elle revient le lendemain.
    const j1 = new Date(2026, 8, 29, 9, 0);
    expect(aRejouer(l, j1)).toHaveLength(1);
    l = apresEssai(l, 'e1', false, j1);
    expect(l[0].prochain).toBe('2026-09-30');
    expect(l[0].rates).toBe(2);
    // J+2 : 1re réussite, retour à J+3.
    const j2 = new Date(2026, 8, 30, 9, 0);
    expect(devientMaitrisee(l[0], true)).toBe(false);
    l = apresEssai(l, 'e1', true, j2);
    expect(l[0].prochain).toBe('2026-10-03');
    expect(l[0].reussites).toBe(1);
    expect(aRejouer(l, new Date(2026, 9, 2, 23, 0))).toEqual([]);
    // Ratée après une réussite : retour à J+1, au pied de l'échelle.
    const j5 = new Date(2026, 9, 3, 9, 0);
    l = apresEssai(l, 'e1', false, j5);
    expect(l[0].prochain).toBe('2026-10-04');
    expect(l[0].reussites).toBe(0);
    // Cinq réussites d'affilée : J+3, J+7, J+14, J+30, puis maîtrisée.
    let d = new Date(2026, 9, 4, 9, 0);
    const ecarts: string[] = [];
    for (let i = 0; i < 4; i++) {
      l = apresEssai(l, 'e1', true, d);
      ecarts.push(l[0].prochain);
      const [y, m, j] = l[0].prochain.split('-').map(Number);
      d = new Date(y, m - 1, j, 9, 0);
    }
    expect(ecarts).toEqual(['2026-10-07', '2026-10-14', '2026-10-28', '2026-11-27']);
    expect(devientMaitrisee(l[0], true)).toBe(true);
    expect(apresEssai(l, 'e1', true, d)).toEqual([]);
    expect(dansJours(j0, 7)).toBe('2026-10-05');
  });

  it('la même erreur ratée de nouveau repart de J+1, au pied de l’échelle', () => {
    const j0 = new Date(2026, 8, 28, 22, 0);
    const l = [{ ...e(1), reussites: 3, rates: 2, prochain: '2026-10-10' }];
    const r = garderRatee(l, e(1), j0);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ prochain: '2026-09-29', rates: 3, reussites: 0 });
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

describe('acceptation : tout coup qui perd moins de 1 point', () => {
  // Cinq positions, chacune avec son meilleur coup et deux autres candidats : l'un perd un peu moins de 1 point
  // (accepté), l'autre 1 point ou plus (refusé).
  const cas: { nom: string; rows: string[]; toPlay: 1 | 2; meilleur: string; proche: string; loin: string; ecartLoin: number }[] = [
    { nom: 'ouverture 9 × 9', rows: ROWS, toPlay: 1, meilleur: 'C4', proche: 'G4', loin: 'E7', ecartLoin: 1 },
    { nom: 'plateau vide, Noir', rows: Array(9).fill('.........'), toPlay: 1, meilleur: 'E5', proche: 'C3', loin: 'D4', ecartLoin: 1.2 },
    { nom: 'Blanc au trait', rows: ROWS, toPlay: 2, meilleur: 'G6', proche: 'C6', loin: 'E3', ecartLoin: 2 },
    { nom: 'milieu de partie', rows: ['.........', '..X.O....', '..XO.....', '..XO.X...', '...XO....', '....XO...', '.....X...', '.........', '.........'], toPlay: 2, meilleur: 'F5', proche: 'D3', loin: 'G7', ecartLoin: 1.01 },
    { nom: '13 × 13', rows: Array(13).fill('.............'), toPlay: 1, meilleur: 'K10', proche: 'D4', loin: 'G7', ecartLoin: 3 },
  ];
  for (const c of cas) {
    it(c.nom, () => {
      const n = c.rows.length, pos = fromRows(c.rows, c.toPlay).pos, a = (l: string) => fromLabel(l, n);
      const an = { lead: 0, engine: 'katago' as const, coups: [
        { move: a(c.meilleur), visits: 40, lead: 5 },
        { move: a(c.proche), visits: 20, lead: 5 - 0.99 },
        { move: a(c.loin), visits: 20, lead: 5 - c.ecartLoin },
      ] };
      const e = creerErreur({ avant: pos, joue: -1, coup: 10, note: 'grosse', meilleur: a(c.meilleur), perte: 8, analyse: an }, MAINTENANT)!;
      expect(coupAccepte(e, a(c.meilleur))).toBe(true);
      expect(coupAccepte(e, a(c.proche))).toBe(true);
      expect(coupAccepte(e, a(c.loin))).toBe(false);
      expect(coupAccepte(e, -1)).toBe(false);
    });
  }
});

describe('#497 : faits de KataGo gardés avec l’erreur (position de Florian, vraie analyse)', () => {
  const N = 9, F = (l: string) => fromLabel(l, N);
  const rows = ['.........', '.........', '......X..', '.........', '...O.....', '.........', '..X......', '..O......', '.........'];
  // Noir C3 et G7, Blanc D5 et C2 : la position de Florian (Caillou, coup 5). Contrôle des rangées.
  const pos = fromRows(rows, 1).pos;
  const source = (): Source => ({
    avant: pos, joue: F('C4'), coup: 5, note: 'erreur', meilleur: F('D3'), perte: 4, analyse: FLORIAN_AVANT, analyseApres: FLORIAN_APRES, adversaire: 'Caillou',
  });

  it('la position est bien celle de Florian', () => {
    expect([F('C3'), F('G7')].every(p => pos.board[p] === 1)).toBe(true);
    expect([F('D5'), F('C2')].every(p => pos.board[p] === 2)).toBe(true);
  });

  it('la variante principale, la riposte et la zone sont gardées, et survivent au stockage', () => {
    const e = creerErreur(source(), MAINTENANT)!;
    expect(e.kataGo?.suite?.map(p => toLabel(p, N))).toEqual(['D3', 'F4', 'D7', 'C7']);
    expect(e.kataGo?.riposte?.map(p => toLabel(p, N))).toEqual(['E3', 'E4', 'D4']);
    expect(e.kataGo?.zone).toMatchObject({ region: 'bas', gain: 4.2, total: 3 });
    expect(lireErreurs(JSON.parse(JSON.stringify([e])))).toEqual([e]);
  });

  it('« Revoir la suite » suit KataGo : ton coup, sa riposte pour Blanc, puis le bon coup et sa variante', () => {
    const pb = versProbleme(creerErreur(source(), MAINTENANT)!);
    const cadres = pb.pourquoi!.cadres();
    expect(cadres.map(c => c.legende)).toEqual([
      'La position de ta partie.', 'Ton coup dans la partie : C4.', 'Selon KataGo, Blanc répond en E3.', 'Suite de KataGo : Noir en E4.',
      'Suite de KataGo : Blanc en D4.', 'Retour à la position de ta partie.', 'Le bon coup : D3.', 'Suite de KataGo : Blanc en F4.',
      'Suite de KataGo : Noir en D7.', 'Suite de KataGo : Blanc en C7.',
    ]);
    // Chaque plateau est la position jouée : la riposte E3 est blanche, la variante finit sur C7 blanc.
    expect(cadres[2].pos.board[F('E3')]).toBe(2);
    expect(cadres[9].pos.board[F('C7')]).toBe(2);
    // Croix sur C4 (encore vide) à partir du bon coup ; zone en carrés sur le dernier plateau.
    expect(cadres.slice(6).every(c => c.croix === F('C4'))).toBe(true);
    expect(cadres[9].zone?.map(p => toLabel(p, N))).toEqual(['D4', 'E3', 'D2', 'E2', 'F2', 'C1', 'D1', 'E1']);
    expect(pb.pourquoi!.texte).toBe('Selon KataGo, l’écart se fait en bas du plateau : avec D3, cette zone vaut environ 4 points de plus pour toi. Après ton coup en C4, le meilleur coup de Blanc selon KataGo, E3, entrait dans cette zone.');
    expect(pb.pourquoi!.ecart).toBe('Écart : environ 4 points selon KataGo.');
  });

  it('rétrocompatible : une erreur gardée avant #497 (sans faits) se relit telle quelle et s’explique comme avant', () => {
    const ancienne = { ...creerErreur(source(), MAINTENANT)!, perte: 5.6 };
    delete ancienne.kataGo;
    const [relue] = lireErreurs(JSON.parse(JSON.stringify([ancienne])));
    expect(relue).toEqual(ancienne);
    expect(relue).not.toHaveProperty('kataGo');
    const pb = versProbleme(relue);
    expect(pb.pourquoi!.texte).toBe('Selon KataGo, D3 gardait environ 6 points de plus que ton coup en C4. Aucune pierre n’est en atari ici : l’écart ne vient pas d’une prise immédiate.');
    expect(pb.pourquoi!.cadres().map(c => c.legende)).toEqual(['La position de ta partie.', 'Le bon coup : D3.']);
  });

  it('des faits mal formés sont retirés seuls : l’erreur reste', () => {
    const e = { ...creerErreur(source(), MAINTENANT)!, kataGo: { suite: 'D3', zone: { region: 'bas', gain: 'beaucoup' } } };
    const [relue] = lireErreurs(JSON.parse(JSON.stringify([e])));
    expect(relue.id).toBe(e.id);
    expect(relue).not.toHaveProperty('kataGo');
  });

  it('sans analyse après le coup joué : seulement la variante (la zone et la riposte en ont besoin)', () => {
    const e = creerErreur({ ...source(), analyseApres: null }, MAINTENANT)!;
    expect(Object.keys(e.kataGo!)).toEqual(['suite']);
  });
});
