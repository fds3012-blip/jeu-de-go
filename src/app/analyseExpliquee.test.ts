// #673 : phrases et plateau de « Pourquoi ? ». Les faits viennent de src/go/explication.ts (testé à part) ; ici on
// vérifie qu'ils sont dits sans rien ajouter, en français et en anglais, et montrés sur la bonne suite.
import { afterEach, describe, expect, it } from 'vitest';
import { fromRows } from '../go/position';
import { fromLabel, toLabel } from '../go/coords';
import { expliquerErreur, type Entree, type Explication } from '../go/explication';
import { choisirLangue } from '../content/i18n';
import { CATALOGUE_ANALYSE, traduireAnalyse } from '../content/i18n/analyse';
import { carresDe, glosesDesErreurs, textesExplication, vueSuite } from './analyseExpliquee';

const N = 9, L = (s: string) => fromLabel(s, N);
function position(noires: string[], blanches: string[]) {
  const rows = Array.from({ length: N }, () => '.'.repeat(N).split(''));
  for (const [liste, ch] of [[noires, 'X'], [blanches, 'O']] as const) for (const s of liste) { const p = L(s); rows[Math.floor(p / N)][p % N] = ch; }
  return fromRows(rows.map(r => r.join('')), 1).pos;
}
const propriete = (v: Record<string, number> = {}, fond = 0) => { const o = new Float32Array(81).fill(fond); for (const [k, x] of Object.entries(v)) o[L(k)] = x; return o; };
const ex = (e: Omit<Entree, 'joue' | 'bon'> & { joue: string; bon: string }): Explication => expliquerErreur({ visitesBon: 40, visitesRiposte: 40, ...e, joue: L(e.joue), bon: L(e.bon) })!;

// Noir E5-E4 en atari (D5, F5, E6, D4, F4) : Noir joue C7, Blanc prend en E3.
const atari = () => ex({ avant: position(['E5', 'E4'], ['D5', 'F5', 'E6', 'D4', 'F4']), joue: 'C7', bon: 'E3', perte: 5.6,
  pvBon: [L('E3'), L('C6'), L('E2')], pvRiposte: [L('E3'), L('C6')], ownBon: propriete({ E5: 0.9, E4: 0.9 }), ownJoue: propriete({ E5: -0.9, E4: -0.9 }) });

afterEach(() => choisirLangue('fr'));

describe('les phrases', () => {
  it('atari ignoré : le fait, la glose d’atari à la première apparition, et ce que fait le bon coup', () => {
    expect(textesExplication(atari(), N, { adv: 'Pomme' })).toEqual({
      erreur: 'Tes 2 pierres en E5 étaient en atari (il ne leur restait qu’une liberté) et tu n’as pas répondu : Pomme les prend en E3.',
      meilleur: 'Avec E3, ces 2 pierres ne sont pas prises.',
      termes: ['atari'],
    });
  });

  it('la glose n’est donnée qu’une fois dans la revue', () => {
    expect(textesExplication(atari(), N, { adv: 'Blanc', gloses: new Set() }).erreur)
      .toBe('Tes 2 pierres en E5 étaient en atari et tu n’as pas répondu : Blanc les prend en E3.');
  });

  it('en anglais', () => {
    choisirLangue('en');
    expect(textesExplication(atari(), N, { adv: 'White' })).toMatchObject({
      erreur: 'Your 2 stones at E5 were in atari (they had only one liberty left) and you didn’t answer: White captures them at E3.',
      meilleur: 'With E3, these 2 stones aren’t captured.',
    });
  });

  it('prise manquée, au singulier', () => {
    const x = ex({ avant: position(['D5', 'F5', 'E6'], ['E5']), joue: 'C7', bon: 'E4', perte: 3, pvBon: [L('E4')], pvRiposte: [L('E4')], ownBon: propriete({ E5: 0.9 }), ownJoue: propriete({ E5: -0.6 }) });
    expect(textesExplication(x, N, { adv: 'Blanc', gloses: new Set() })).toMatchObject({
      erreur: 'Sa pierre en E5 était en atari : tu pouvais la prendre.',
      meilleur: 'E4 prend une pierre tout de suite.',
    });
  });

  it('zone : jamais plus de points que la perte de la revue', () => {
    const bon = propriete(), joue = propriete();
    for (const k of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2']) { bon[L(k)] = 0.8; joue[L(k)] = 0; }
    const x = ex({ avant: position(['C3', 'G7'], ['G3']), joue: 'E5', bon: 'D2', perte: 5.5, ownBon: bon, ownJoue: joue });
    // 8 × 0,8 = 6,4 points dans le coin, perte de 5,5 : « environ 6 points » (5,5 arrondi), jamais 6,4.
    expect(textesExplication(x, N, { adv: 'Blanc' })).toMatchObject({
      erreur: 'Tu perds environ 6 points dans le coin en bas à gauche.',
      meilleur: 'Avec D2, tu gagnes environ 6 points dans le coin en bas à gauche.',
    });
  });

  it('sans raison sûre : on le dit, chiffré, avec la réponse de l’adversaire ; « rien n’est pris » seulement si c’est vérifié', () => {
    const avant = position(['C3'], ['G7']);
    const calme = ex({ avant, joue: 'E5', bon: 'D4', perte: 2.4, pvRiposte: [L('C7')], ownBon: propriete({}, 0.1), ownJoue: propriete({}, 0.05) });
    expect(textesExplication(calme, N, { adv: 'Blanc' })).toEqual({
      erreur: 'Blanc répond en C7. KataGo préfère D4, d’environ 2 points. Rien n’est pris et aucun groupe ne change de sort : la raison est surtout positionnelle.',
      meilleur: 'KataGo préfère D4 : environ 2 points de plus que ton coup.',
      termes: [],
    });
    const sansPropriete = ex({ avant, joue: 'E5', bon: 'D4', perte: 2.4 });
    expect(textesExplication(sansPropriete, N, { adv: 'Blanc' }).erreur).toBe('KataGo préfère D4, d’environ 2 points ; la raison est surtout positionnelle.');
  });

  it('point commun : l’adversaire répond au point que KataGo conseillait', () => {
    const x = ex({ avant: position(['C3'], ['G7']), joue: 'E5', bon: 'D4', perte: 3.2, pvRiposte: [L('D4')] });
    expect(textesExplication(x, N, { adv: 'Blanc' })).toMatchObject({
      erreur: 'Blanc répond en D4 : c’est justement le coup que KataGo préférait pour toi, d’environ 3 points.',
      meilleur: 'D4 est un point clé pour les deux camps : Blanc l’a pris juste après ton coup.',
    });
  });

  it('initiative : gote et sente expliqués, la suite de KataGo citée', () => {
    const x = ex({ avant: position(['C5', 'G5'], ['E5']), joue: 'G3', bon: 'C3', perte: 3, pvBon: [L('C3'), L('D3'), L('G7')], pvRiposte: [L('C7')] });
    expect(textesExplication(x, N, { adv: 'Blanc' })).toMatchObject({
      erreur: 'Ton coup est gote (un coup qui n’oblige pas l’adversaire à répondre) : Blanc joue tout de suite ailleurs, en C7.',
      meilleur: 'C3 est sente (un coup qui oblige l’adversaire à répondre) : Blanc répond en D3, puis tu joues ailleurs, en G7.',
      termes: ['gote', 'sente'],
    });
  });

  it('coupe : la glose de « couper », puis la parade', () => {
    const x = ex({ avant: position(['D4', 'E5'], ['D5']), joue: 'H8', bon: 'E4', perte: 4, pvBon: [L('E4')], pvRiposte: [L('E4')], ownBon: propriete({ D4: 0.7, E5: 0.7 }), ownJoue: propriete({ D4: 0.1, E5: 0.1 }) });
    expect(textesExplication(x, N, { adv: 'Blanc' })).toMatchObject({
      erreur: 'Blanc répond en E4 et coupe tes pierres (couper, c’est séparer des pierres) : elles sont séparées.',
      meilleur: 'E4 prend le point de coupe : tes pierres restent ensemble.',
    });
  });

  it('chaque clé existe en anglais, avec les mêmes variables', () => {
    const vars = (s: unknown) => [...JSON.stringify(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const k of Object.keys(CATALOGUE_ANALYSE.fr) as (keyof typeof CATALOGUE_ANALYSE.fr)[]) {
      expect(CATALOGUE_ANALYSE.en[k], k).toBeTruthy();
      expect([...new Set(vars(CATALOGUE_ANALYSE.en[k]))], k).toEqual([...new Set(vars(CATALOGUE_ANALYSE.fr[k]))]);
    }
    expect(traduireAnalyse('en', 'pts', { n: 1 })).toBe('1 point');
  });
});

describe('les gloses de la revue', () => {
  it('chaque mot du go est expliqué à sa première apparition, dans l’ordre de la partie', () => {
    const a = atari();
    const g = glosesDesErreurs(new Map([[12, a], [5, a], [20, ex({ avant: position(['C3'], ['G7']), joue: 'E5', bon: 'D4', perte: 2 })]]));
    expect([...g.get(5)!]).toEqual(['atari']);
    expect([...g.get(12)!]).toEqual([]);
    expect([...g.get(20)!]).toEqual([]);
  });
});

describe('le plateau de la suite', () => {
  it('ta suite : coups numérotés à partir de ton coup, pierres concernées entourées tant qu’elles sont là', () => {
    const x = atari();
    const v0 = vueSuite(x, 'joue', 0);
    expect([...v0.numeros]).toEqual([[L('C7'), 1]]);
    expect(v0.cibles.map(p => toLabel(p, N)).sort()).toEqual(['E4', 'E5']);
    expect(v0.longueur).toBe(3);
    const v1 = vueSuite(x, 'joue', 1);
    // Prises : plus de cible ; E3 porte le numéro 2.
    expect(v1.cibles).toEqual([]);
    expect(v1.numeros.get(L('E3'))).toBe(2);
    expect(v1.pos.board[L('E5')]).toBe(0);
    expect(v1.dernier).toBe(L('E3'));
  });

  it('la suite du bon coup : ton coup marqué d’une croix tant qu’il est vide ; étape bornée', () => {
    const x = atari();
    const v = vueSuite(x, 'bon', 99);
    expect(v.croix).toBe(L('C7'));
    expect(v.numeros.get(L('E3'))).toBe(1);
    expect(vueSuite(x, 'bon', -3).numeros.size).toBe(1);
  });

  it('zone : carrés de ta couleur à la fin de la suite du bon coup, cadre à la fin de ta suite', () => {
    const bon = propriete(), joue = propriete();
    for (const k of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2']) { bon[L(k)] = 0.8; joue[L(k)] = 0; }
    const x = ex({ avant: position(['C3', 'G7'], ['G3']), joue: 'E5', bon: 'D2', perte: 6, ownBon: bon, ownJoue: joue });
    expect(vueSuite(x, 'bon', 0).carres?.length).toBe(8);
    expect(vueSuite(x, 'joue', 0).cadre?.length).toBe(8);
    expect(vueSuite(x, 'joue', 0).carres).toBeNull();
    expect(Array.from(carresDe([0, 1], 3, 2))).toEqual([-1, -1, 0, 0, 0, 0, 0, 0, 0]);
  });
});
