// Issue #693 : le texte d'erreur d'un problème ne parle que du coup joué. Chaque mauvais coup de chaque problème est
// rejoué ; ce qui s'affiche (texte fixe gardé, ou phrase calculée) ne dit que des faits vrais.
import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES } from '../content/puzzles';
import { PROBLEMES_EN } from '../content/problemes.en';
import { parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from '../go/coords';
import { cederLaMain } from '../go/preuve-par-coup';
import { play, type Position } from '../go/rules';
import { comprendreErreur } from './comprendreErreur';
import { refutationPour, repliqueAnnoncee, SANS_REPONSE, texteVautPour } from './refutationJuste';

const tous = parsePuzzles(ALL_PUZZLES);
const pz = (id: string) => tous.find(p => p.id === id)!;
const at = (l: string, size = 9) => fromLabel(l, size);
const coupsFaux = (p: Puzzle) => {
  const { pos } = startOf(p);
  return [...Array(pos.board.length).keys()].filter(m => !p.answers.includes(m) && typeof play(pos, m) !== 'string');
};
const apres = (p: Puzzle, m: number) => play(startOf(p).pos, m) as Position;
const pierresPrises = (p: Puzzle, m: number) => {
  const avant = startOf(p).pos, r = apres(p, m);
  return avant.board.filter((c, i) => c === (3 - p.toPlay) && r.board[i] !== c).length;
};

/** Problèmes du rapport QA du 22/10/2026 (bug 2) : leur texte fixe parle d'un coup précis. */
const DU_RAPPORT = ['n02', 'n03', 'n05', 'n07', 'n08', 'n09', 'n10', 'n11', 'n12', 'n14', 'n16', 'n17', 'j02', 'j03', 'j12', 'o02', 'o05', 'o07', 'o08', 'o11'];

describe('le texte fixe ne s’affiche que pour le coup qu’il décrit', () => {
  it('n05 : « Tu sauves G2 » seulement pour le coup qui sauve G2 (G3), pas pour A9', () => {
    expect(pz('n05').refutation).toContain('Tu sauves G2');
    expect(refutationPour(pz('n05'), at('A9'), null)).toBeNull();
    expect(refutationPour(pz('n05'), at('G3'), null)).toBe(pz('n05').refutation);
  });
  it('n03 : « Tu prends B8 » seulement pour le coup qui prend B8 (B7), pas pour J1', () => {
    expect(refutationPour(pz('n03'), at('J1'), null)).toBeNull();
    expect(refutationPour(pz('n03'), at('B7'), null)).toBe(pz('n03').refutation);
    expect(pierresPrises(pz('n03'), at('B7'))).toBe(1);
  });
  it('n02, n17 : « En C4, tu prends une pierre », « Tu prends deux pierres en A9 » : seul ce coup', () => {
    expect(coupsFaux(pz('n02')).filter(m => texteVautPour(pz('n02'), m)).map(m => toLabel(m, 9))).toEqual(['C4']);
    expect(pierresPrises(pz('n02'), at('C4'))).toBe(1);
    expect(coupsFaux(pz('n17')).filter(m => texteVautPour(pz('n17'), m)).map(m => toLabel(m, 9))).toEqual(['A9']);
    expect(pierresPrises(pz('n17'), at('A9'))).toBe(2);
  });
  it('un texte qui vaut pour toute erreur (« Si tu joues ailleurs… ») reste montré partout', () => {
    for (const m of coupsFaux(pz('n01'))) expect(texteVautPour(pz('n01'), m)).toBe(true);
    for (const m of coupsFaux(pz('h01'))) expect(texteVautPour(pz('h01'), m)).toBe(true);
  });
  it('« Après E1, Blanc s’allonge… » (lot A) : seul E1 ; « Si tu joues A1 ou C1… Si tu joues D1… » : ces trois coups', () => {
    expect(coupsFaux(pz('a09')).filter(m => texteVautPour(pz('a09'), m)).map(m => toLabel(m, 9))).toEqual(['E1']);
    expect(coupsFaux(pz('j07')).filter(m => texteVautPour(pz('j07'), m)).map(m => toLabel(m, 9)).sort()).toEqual(['A1', 'C1', 'D1']);
  });
  it('la portée se lit sur le français : l’anglais suit exactement le même choix', () => {
    for (const id of DU_RAPPORT) {
      const en = PROBLEMES_EN[id].refutation!;
      const p = { ...pz(id), refutation: en, refutationFr: pz(id).refutation };
      for (const m of coupsFaux(p)) expect(refutationPour(p, m, null) === en, `${id} ${toLabel(m, 9)}`).toBe(texteVautPour(pz(id), m));
    }
  });
});

describe('réplique annoncée par le texte', () => {
  it('une réplique de base, une réplique réservée à certaines erreurs, ou « pas besoin de répondre »', () => {
    const t = 'Pas tout à fait. Blanc joue G1 (ou D1 si tu as joué E1 ou C1) et vit.';
    expect(repliqueAnnoncee(t, 'Blanc', at('A9'), 9)).toBe(at('G1'));
    expect(repliqueAnnoncee(t, 'Blanc', at('E1'), 9)).toBe(at('D1'));
    expect(repliqueAnnoncee('Pas tout à fait. Blanc s’allonge en F5, ou en E6 si tu as joué F5 ou F4, et fuit.', 'Blanc', at('F4'), 9)).toBe(at('E6'));
    expect(repliqueAnnoncee('Pas tout à fait. Blanc joue C1. Si tu as joué A1, il n’a même pas besoin de répondre.', 'Blanc', at('A1'), 9)).toBe(SANS_REPONSE);
    expect(repliqueAnnoncee('Pas tout à fait. Cherche le point commun.', 'Blanc', at('A9'), 9)).toBeNull();
  });
  it('un texte qui annonce une autre réplique que la réplique prouvée est caché (z13 : J2 annoncé, F1 prouvé)', () => {
    const p = pz('z13'), faux = at('A9');
    const e = comprendreErreur(p, faux)!;
    expect(toLabel(e.reponse, 9)).toBe('F1');
    expect(refutationPour(p, faux, e)).toBeNull();
  });
  it('n05 jouer A9 : Blanc prend les deux pierres marquées, et la phrase le dit au pluriel', () => {
    const e = comprendreErreur(pz('n05'), at('A9'))!;
    expect(e.phrase).toBe('Blanc répond en D4 et prend tes 2 pierres marquées.');
  });
});

describe('chaque mauvais coup des problèmes du rapport : ce qui est dit est vrai', () => {
  it('sur les 20 problèmes : texte gardé = coup décrit ; prise annoncée = prise jouée ; réplique annoncée = réplique prouvée', async () => {
    for (const id of DU_RAPPORT) {
      const p = pz(id);
      let gardes = 0, caches = 0;
      for (const m of coupsFaux(p)) {
        const comprise = comprendreErreur(p, m);
        const texte = refutationPour(p, m, comprise);
        if (!texte) { caches++; continue; }
        gardes++;
        const fr = p.refutationFr!;
        expect(texteVautPour(p, m), `${id} ${toLabel(m, 9)}`).toBe(true);
        // « tu prends une / deux / trois pierre(s) » : le nombre de pierres prises par ce coup.
        const nb = /tu prends (une|deux|trois|quatre) pierres?/.exec(fr);
        if (nb) expect(pierresPrises(p, m), `${id} ${toLabel(m, 9)}`).toBe(['une', 'deux', 'trois', 'quatre'].indexOf(nb[1]) + 1);
        // « tu prends D1 » : la pierre D1 est bien prise par ce coup.
        for (const cible of fr.matchAll(/tu prends ([A-HJ-T]\d)\b/g)) expect(apres(p, m).board[at(cible[1])], `${id} ${toLabel(m, 9)}`).toBe(0);
        // La réplique annoncée est celle que le lecteur exact prouve.
        if (comprise) {
          const annoncee = repliqueAnnoncee(fr, comprise.apresFaux.toPlay === 2 ? 'Blanc' : 'Noir', m, 9);
          if (annoncee !== null) expect(annoncee, `${id} ${toLabel(m, 9)}`).toBe(comprise.reponse);
        }
      }
      // Ces problèmes ont un texte précis : il est caché pour presque tous les autres coups.
      expect(caches, id).toBeGreaterThan(gardes);
      await cederLaMain();
    }
  }, 120000);
});

describe('tous les problèmes : un texte qui cite un coup précis en tête est toujours rattaché à ce coup', () => {
  it('aucun texte « En X, … », « Après X, … », « Tu prends X… » n’est montré pour un autre coup (sans preuve ni borne)', () => {
    const TETE = /^Pas [^.]{1,24}\.\s+(?:(?:En|Après) ([A-HJ-T]\d{1,2})\b|Tu (?:prends|sauves)\b)/;
    let vus = 0;
    for (const p of tous) {
      if (!p.refutation || !TETE.test(p.refutation)) continue;
      vus++;
      const { pos } = startOf(p);
      const montres = coupsFaux(p).filter(m => refutationPour(p, m, null) !== null);
      const m = TETE.exec(p.refutation)![1];
      // Au plus quelques coups (celui qui est dit, ou ceux qui prennent / sauvent la pierre citée).
      expect(montres.length, p.id).toBeLessThanOrEqual(3);
      if (m) expect(montres.map(x => toLabel(x, pos.size)), p.id).toContain(m);
    }
    expect(vus).toBeGreaterThanOrEqual(20);
  });
});
