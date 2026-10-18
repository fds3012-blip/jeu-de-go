// #671 : la vignette de la carte « Double atari » (src/ui/vignettes.ts, clé theme-double-atari) est le problème v06
// « Deux atari à la fois » (src/content/lots/v-captures-lecons.ts, prouvé par src/go/lot-v.test.ts), vu dans la fenêtre
// C à F, lignes 6 à 3. Ce test la vérifie avec le moteur de règles : recadrage exact (aucune pierre perdue), puis le
// coup en jade met deux pierres blanches distinctes en atari, avec une seule liberté chacune.
import { describe, expect, it } from 'vitest';
import LOT_V from '../content/lots/v-captures-lecons';
import { THEME_DU_PROBLEME } from '../content/themes';
import { VIGNETTE_DE_THEME } from '../app/themesApprendre';
import { MOTIFS, type Point } from '../ui/vignettes';
import { fromLabel, toLabel } from './coords';
import { fromRows } from './position';
import { groupAt, play, type Position } from './rules';

const N = 9;
/** Fenêtre de la vignette : colonnes C à F (x 2 à 5), lignes 6 à 3 (y 3 à 6, y depuis le haut). */
const X0 = 2, Y0 = 3;
const versPoint = ([c, r]: Point) => (Y0 + r) * N + (X0 + c);
const dansFenetre = (p: number) => { const x = p % N, y = Math.floor(p / N); return x >= X0 && x < X0 + 4 && y >= Y0 && y < Y0 + 4; };
const lbl = (p: number) => toLabel(p, N);
const at = (l: string) => fromLabel(l, N);
const trier = (ps: Iterable<number>) => [...ps].map(lbl).sort();

const v06 = LOT_V.find(p => p.id === 'v06')!;
const { pos: depart } = fromRows((v06.setup as { rows: string[] }).rows, 1);
const motif = MOTIFS[VIGNETTE_DE_THEME['double-atari']!];

describe('#671 : vignette « Double atari », tirée du problème v06', () => {
  it('la source : v06, thème double-atari, Noir joue E5', () => {
    expect(VIGNETTE_DE_THEME['double-atari']).toBe('theme-double-atari');
    expect(v06.title).toBe('Deux atari à la fois');
    expect(THEME_DU_PROBLEME['v06']).toBe('double-atari');
    expect(v06.answers).toEqual(['E5']);
    expect(depart.toPlay).toBe(1);
  });

  it('le recadrage est exact : toutes les pierres de v06 sont dans la fenêtre, et ce sont celles de la vignette', () => {
    const noires: number[] = [], blanches: number[] = [];
    depart.board.forEach((c, p) => { if (c === 1) noires.push(p); if (c === 2) blanches.push(p); });
    for (const p of [...noires, ...blanches]) expect(dansFenetre(p), lbl(p)).toBe(true);
    expect(trier((motif.noir ?? []).map(versPoint))).toEqual(trier(noires));
    expect(trier((motif.blanc ?? []).map(versPoint))).toEqual(trier(blanches));
    expect(trier(noires)).toEqual(['D4', 'D6', 'F4']);
    expect(trier(blanches)).toEqual(['D5', 'E4']);
    // Le seul marqueur est le jade (le coup à jouer, comme sur les autres vignettes) : c'est la réponse, E5.
    expect((motif.jade ?? []).map(versPoint).map(lbl)).toEqual(['E5']);
    expect(motif.or ?? []).toEqual([]);
    expect(motif.coin).toBeFalsy();
  });

  it('avant E5 : deux pierres blanches séparées, deux libertés chacune, E5 en commun', () => {
    const d5 = groupAt(depart.board, N, at('D5')), e4 = groupAt(depart.board, N, at('E4'));
    expect(trier(d5.stones)).toEqual(['D5']);
    expect(trier(e4.stones)).toEqual(['E4']);
    expect(trier(d5.liberties)).toEqual(['C5', 'E5']);
    expect(trier(e4.liberties)).toEqual(['E3', 'E5']);
  });

  it('après E5 : D5 et E4 sont deux groupes distincts, chacun en atari avec une seule liberté (C5, E3) ; E5 n’est pas en atari', () => {
    const r = play(depart, at('E5'));
    expect(typeof r).not.toBe('string');
    const apres = r as Position;
    expect(apres.board[at('E5')]).toBe(1);
    expect(apres.captures).toEqual(depart.captures);
    const d5 = groupAt(apres.board, N, at('D5')), e4 = groupAt(apres.board, N, at('E4'));
    expect(trier(d5.stones)).toEqual(['D5']);
    expect(trier(e4.stones)).toEqual(['E4']);
    expect(d5.stones).not.toContain(at('E4'));
    expect(d5.liberties.size).toBe(1);
    expect(e4.liberties.size).toBe(1);
    expect(trier(d5.liberties)).toEqual(['C5']);
    expect(trier(e4.liberties)).toEqual(['E3']);
    // Les deux dernières libertés sont dans la fenêtre, et vides sur la vignette : on les voit.
    for (const l of ['C5', 'E3']) expect(dansFenetre(at(l)), l).toBe(true);
    // La pierre qui joue le double atari a deux libertés (E6, F5) : Blanc ne peut pas la prendre d'abord.
    expect(trier(groupAt(apres.board, N, at('E5')).liberties)).toEqual(['E6', 'F5']);
  });

  it('chaque sauvetage laisse l’autre pierre en prise : Noir capture au coup suivant', () => {
    const apres = play(depart, at('E5')) as Position;
    const c5 = play(apres, at('C5')) as Position;
    expect((play(c5, at('E3')) as Position).board[at('E4')]).toBe(0);
    const e3 = play(apres, at('E3')) as Position;
    expect((play(e3, at('C5')) as Position).board[at('D5')]).toBe(0);
  });
});
