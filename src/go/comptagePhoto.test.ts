// Comptage d'un plateau photographié (#655) : positions dont le score est connu, compté à la main, dans les deux règles.
import { describe, expect, it } from 'vitest';
import { compterPhoto, KOMI_USUEL } from './comptagePhoto';
import { fromRows } from './position';
import { neighbors, newPosition, play, type Position } from './rules';

const plateau = (rows: string[]) => fromRows(rows).pos.board;
const at = (x: number, y: number, n = 9) => y * n + x;

// Mur noir en colonne D, mur blanc en colonne E : 27 points pour Noir, 36 pour Blanc, 9 pierres chacun.
const MURS = [
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
];

// Un point neutre (dame) en E1 : il touche une noire et deux blanches.
const DAME = [
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...XO....',
  '...X.O...',
];

// Seki en haut à gauche : œil en A9 pour Blanc, œil en E9 pour
// Noir, liberté partagée C9. Aucun ne peut jouer C9 sans se mettre en atari : vie commune.
// Blanc intérieur : B9, A8, B8, C8 (œil A9). Noir intérieur : D9, D8, E8, F8, F9 (œil E9).
// Murs : noir en A7-C7 et sur toute la ligne 6 ; blanc en G9, G8 et D7-J7. Territoire : Noir 45 (lignes 1 à 5),
// Blanc 4 (H9, J9, H8, J8).
const SEKI = [
  '.O.X.XO..',
  'OOOXXXO..',
  'XXXOOOOOO',
  'XXXXXXXXX',
  '.........',
  '.........',
  '.........',
  '.........',
  '.........',
];

describe('compterPhoto : positions connues', () => {
  it('deux murs, japonais et chinois', () => {
    const j = compterPhoto(plateau(MURS), 9, { regle: 'japanese', komi: 6.5 });
    expect(j.noir).toEqual({ territoire: 27, prisonniers: 0, pierres: 0, komi: 0, total: 27 });
    expect(j.blanc).toEqual({ territoire: 36, prisonniers: 0, pierres: 0, komi: 6.5, total: 42.5 });
    expect([j.gagnant, j.marge]).toEqual([2, 15.5]);
    expect(j.neutres).toBe(0);

    const c = compterPhoto(plateau(MURS), 9, { regle: 'chinese', komi: 7.5 });
    expect(c.noir).toEqual({ territoire: 27, prisonniers: 0, pierres: 9, komi: 0, total: 36 });
    expect(c.blanc).toEqual({ territoire: 36, prisonniers: 0, pierres: 9, komi: 7.5, total: 52.5 });
    expect([c.gagnant, c.marge]).toEqual([2, 16.5]);
  });

  it('un point neutre (dame) ne compte pour personne, dans les deux règles', () => {
    const j = compterPhoto(plateau(DAME), 9, { regle: 'japanese', komi: 6.5 });
    expect(j.neutres).toBe(1);
    expect(j.owner[at(4, 8)]).toBe(0);
    expect([j.noir.total, j.blanc.total]).toEqual([27, 35 + 6.5]);
    const c = compterPhoto(plateau(DAME), 9, { regle: 'chinese', komi: 7.5 });
    expect(c.neutres).toBe(1);
    // 27 + 9 pierres ; 35 + 9 pierres (8 en colonne E, une en F1) : 36 + 44 + 1 neutre = 81.
    expect([c.noir.total, c.blanc.total]).toEqual([36, 44 + 7.5]);
    expect(c.noir.total + c.blanc.total - c.blanc.komi + c.neutres).toBe(81);
  });

  it('pierre morte : prisonnier en japonais, simple point de zone en chinois', () => {
    const rows = [...MURS];
    rows[4] = '.O.XO....'; // pierre blanche morte en B5, chez Noir
    const mortes = [at(1, 4)];
    const j = compterPhoto(plateau(rows), 9, { regle: 'japanese', komi: 6.5, mortes });
    expect(j.noir).toMatchObject({ territoire: 27, prisonniers: 1, total: 28 });
    expect(j.mortes).toEqual({ noires: 0, blanches: 1 });
    const c = compterPhoto(plateau(rows), 9, { regle: 'chinese', komi: 7.5, mortes });
    expect(c.noir).toMatchObject({ territoire: 27, pierres: 9, total: 36 });
    expect(c.blanc).toMatchObject({ pierres: 9, total: 52.5 });
    // Non marquée morte, la pierre blanche ouvre la zone de Noir : plus de territoire noir (zone touchée par les deux).
    const vivante = compterPhoto(plateau(rows), 9, { regle: 'japanese', komi: 6.5 });
    expect(vivante.noir.territoire).toBe(0);
  });

  it('prisonniers saisis : comptés en japonais, ignorés en chinois', () => {
    const prisonniers = { noir: 3, blanc: 5 };
    const j = compterPhoto(plateau(MURS), 9, { regle: 'japanese', komi: 6.5, prisonniers });
    expect(j.noir).toMatchObject({ prisonniers: 3, total: 30 });
    expect(j.blanc).toMatchObject({ prisonniers: 5, total: 36 + 5 + 6.5 });
    const c = compterPhoto(plateau(MURS), 9, { regle: 'chinese', komi: 7.5, prisonniers });
    expect(c.noir.total).toBe(36);
    expect(c.blanc.total).toBe(52.5);
  });

  it('seki : en japonais, ni ses yeux ni sa liberté partagée ne comptent ; en chinois, les yeux comptent', () => {
    const j = compterPhoto(plateau(SEKI), 9, { regle: 'japanese', komi: 6.5 });
    expect(j.seki).toBe(4 + 5);
    expect(j.noir).toMatchObject({ territoire: 45, total: 45 });
    expect(j.blanc).toMatchObject({ territoire: 4, total: 10.5 });
    expect(j.neutres).toBe(3); // A9, C9, E9
    expect([j.gagnant, j.marge]).toEqual([1, 34.5]);

    const c = compterPhoto(plateau(SEKI), 9, { regle: 'chinese', komi: 7.5 });
    // Noir : 45 + œil E9 + 17 pierres ; Blanc : 4 + œil A9 + 12 pierres + 7,5.
    expect(c.noir).toMatchObject({ territoire: 46, pierres: 17, total: 63 });
    expect(c.blanc).toMatchObject({ territoire: 5, pierres: 12, total: 24.5 });
    expect(c.neutres).toBe(1); // C9 seulement
    expect([c.gagnant, c.marge]).toEqual([1, 38.5]);
  });

  it('égalité : pas de gagnant', () => {
    const r = compterPhoto(plateau(MURS), 9, { regle: 'japanese', komi: 0, prisonniers: { noir: 9, blanc: 0 } });
    expect([r.noir.total, r.blanc.total, r.gagnant, r.marge]).toEqual([36, 36, 0, 0]);
  });

  it('komi usuel : 6,5 en japonais, 7,5 en chinois', () => {
    expect(KOMI_USUEL).toEqual({ japanese: 6.5, chinese: 7.5 });
  });

  it('ignore une pierre morte marquée sur un point vide et des prisonniers négatifs', () => {
    const r = compterPhoto(plateau(MURS), 9, { regle: 'japanese', komi: 6.5, mortes: [at(0, 0)], prisonniers: { noir: -4, blanc: Number.NaN } });
    expect(r.noir.total).toBe(27);
    expect(r.blanc.total).toBe(42.5);
  });
});

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function hasard(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Partie au hasard (sans remplir ses propres yeux) : position finale et pierres posées par couleur. */
function partieAuHasard(graine: number, taille = 9, coups = 140): { pos: Position; posees: [number, number, number] } {
  const r = hasard(graine), nb = neighbors(taille);
  let pos = newPosition(taille);
  const posees: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < coups; k++) {
    const c = pos.toPlay;
    const vides = [...pos.board.keys()].filter(p => !pos.board[p] && !nb[p].every(q => pos.board[q] === c));
    let joue = false;
    while (vides.length) {
      const p = vides.splice(Math.floor(r() * vides.length), 1)[0];
      const suite = play(pos, p);
      if (typeof suite !== 'string') { pos = suite; posees[c]++; joue = true; break; }
    }
    if (!joue) pos = { ...pos, toPlay: (3 - c) as 1 | 2, ko: -1, lastMove: -1 };
  }
  return { pos, posees };
}

describe('chinois et japonais : la relation attendue', () => {
  // Noir a posé n_N pierres et Blanc n_B, P_N et P_B prisonniers (prises et mortes). Pierres vivantes : n_N − P_B et
  // n_B − P_N. Écart chinois − écart japonais = (n_N − P_B − n_B + P_N) − (P_N − P_B) = n_N − n_B, à komi égal,
  // plus la différence de territoire due aux yeux des seki (comptés en chinois seulement).
  for (const graine of [1, 2, 3, 7, 11, 42, 99, 2026]) {
    it(`partie au hasard ${graine}`, () => {
      const { pos, posees } = partieAuHasard(graine);
      // Garde-fou du test : la partie a bien des prises (sinon la relation serait triviale).
      expect(pos.captures[1] + pos.captures[2]).toBeGreaterThan(0);
      const r = hasard(graine * 31);
      // Quelques pierres marquées mortes au hasard : la relation tient quand même.
      const mortes = [...pos.board.keys()].filter(p => pos.board[p] && r() < 0.08);
      const prisonniers = { noir: pos.captures[1], blanc: pos.captures[2] };
      const j = compterPhoto(pos.board, 9, { regle: 'japanese', komi: 7, prisonniers, mortes });
      const c = compterPhoto(pos.board, 9, { regle: 'chinese', komi: 7, mortes });
      const ecartJ = j.noir.total - j.blanc.total, ecartC = c.noir.total - c.blanc.total;
      const yeuxSeki = (c.noir.territoire - j.noir.territoire) - (c.blanc.territoire - j.blanc.territoire);
      expect(ecartC - ecartJ).toBe(posees[1] - posees[2] + yeuxSeki);
      // Les pierres vivantes se déduisent des pierres posées, des prises et des mortes.
      expect(c.noir.pierres).toBe(posees[1] - pos.captures[2] - j.mortes.noires);
      expect(c.blanc.pierres).toBe(posees[2] - pos.captures[1] - j.mortes.blanches);
    });
  }

  it('sans seki ni passe, Noir qui commence : l’écart chinois dépasse le japonais de 0 ou 1 point', () => {
    const { pos, posees } = partieAuHasard(5, 9, 60);
    const j = compterPhoto(pos.board, 9, { regle: 'japanese', komi: 7, prisonniers: { noir: pos.captures[1], blanc: pos.captures[2] } });
    const c = compterPhoto(pos.board, 9, { regle: 'chinese', komi: 7 });
    expect(j.seki + c.seki).toBe(0);
    expect(posees[1] - posees[2]).toBeGreaterThanOrEqual(0);
    expect((c.noir.total - c.blanc.total) - (j.noir.total - j.blanc.total)).toBe(posees[1] - posees[2]);
  });
});
