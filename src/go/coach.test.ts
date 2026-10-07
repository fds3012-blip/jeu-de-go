// Coach Mochi (#470) : chaque détection, cas positifs et négatifs, puis une partie réelle rejouée coup par coup.
import { describe, expect, it } from 'vitest';
import { atariNouveau, priseRatee, reglesZoneLibre, unSeulOeil, zoneLibre, type MomentCoach } from './coach';
import { fromLabel, toLabel } from './coords';
import { fromRows } from './position';
import { groupAt, newPosition, play, type Position } from './rules';
import { COUPS_424 } from '../app/partie424.fixture';

const pos = (rows: string[], trait: 1 | 2 = 1) => fromRows(rows, trait).pos;
const jouer = (p: Position, label: string): Position => {
  const r = play(p, label === 'passe' ? -1 : fromLabel(label, p.size));
  if (typeof r === 'string') throw new Error(`${label} : ${r}`);
  return r;
};
const labels = (ps: number[], size = 9) => ps.map(p => toLabel(p, size)).sort();

describe('atari : un groupe du joueur vient d’être mis en atari', () => {
  // Noir E5 entouré par Blanc sur trois côtés : Blanc vient de jouer E4.
  const avant = pos([
    '.........',
    '.........',
    '.........',
    '....O....',
    '...OX....',
    '.........',
    '.........',
    '.........',
    '.........',
  ], 2);
  it('signale le groupe, sa pierre repère et sa dernière liberté', () => {
    const apres = jouer(avant, 'E4');
    const m = atariNouveau(avant, apres, 1);
    expect(m?.type).toBe('atari');
    if (m?.type !== 'atari') return;
    expect(toLabel(m.repere, 9)).toBe('E5');
    expect(toLabel(m.liberte, 9)).toBe('F5');
    expect(groupAt(apres.board, 9, m.repere).liberties.size).toBe(1);
  });
  it('se tait si le groupe était déjà en atari avant le coup adverse', () => {
    const apres = jouer(avant, 'E4');
    const encore = jouer(jouer(apres, 'A1'), 'A9');
    expect(atariNouveau(jouer(apres, 'A1'), encore, 1)).toBeNull();
  });
  it('se tait avec deux libertés', () => {
    expect(atariNouveau(avant, jouer(avant, 'A1'), 1)).toBeNull();
  });
  it('ne parle pas des pierres adverses en atari', () => {
    // Blanc se met lui-même en atari : ce n'est pas un groupe du joueur.
    const p = pos([
      '.........',
      '.........',
      '.........',
      '....X....',
      '...X.X...',
      '.........',
      '.........',
      '.........',
      '.........',
    ], 2);
    expect(atariNouveau(p, jouer(p, 'E5'), 1)).toBeNull();
  });
  it('un nouveau groupe en atari, à côté d’un autre déjà en atari, est signalé', () => {
    const p = pos([
      'XO.......',
      '.........',
      '.........',
      '....O....',
      '...OX....',
      '.........',
      '.........',
      '.........',
      '.........',
    ], 2);
    const m = atariNouveau(p, jouer(p, 'E4'), 1);
    expect(m?.type === 'atari' && toLabel(m.repere, 9)).toBe('E5');
  });
});

describe('un seul œil : prouvé par la lecture, sinon rien', () => {
  // Coin en bas à gauche : Noir A2 B2 C2 B1, un œil en A1, une liberté dehors en C1 ; mur blanc solide.
  const unOeil = [
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    'OOOO.....',
    'XXXO.....',
    '.X.O.....',
  ];
  it('signale le groupe qui n’a qu’un œil et que Blanc prendrait en jouant le premier', () => {
    const m = unSeulOeil(pos(unOeil), 1);
    expect(m?.type).toBe('un-oeil');
    if (m?.type !== 'un-oeil') return;
    expect(labels(m.oeil)).toEqual(['A1']);
    expect(labels(m.pierres)).toEqual(['A2', 'B1', 'B2', 'C2']);
    expect(toLabel(m.repere, 9)).toBe('A2');
  });
  it('se tait quand le groupe a deux yeux (vivant)', () => {
    expect(unSeulOeil(pos([
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      'OOOOO....',
      'XXXXO....',
      '.X.XO....',
    ]), 1)).toBeNull();
  });
  it('se tait quand le groupe peut encore sortir (zone ouverte)', () => {
    expect(unSeulOeil(pos([
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      'OO.......',
      'XXX......',
      '.X.......',
    ]), 1)).toBeNull();
  });
  it('se tait quand le mur adverse est fragile (il pourrait être pris pendant la lecture)', () => {
    expect(unSeulOeil(pos([
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      'XXXXX....',
      'OOOOX....',
      'XXXOX....',
      '.X.O.....',
    ]), 1)).toBeNull();
  });
  it('se tait devant un faux œil (diagonale adverse : l’œil est bordé par deux chaînes)', () => {
    // A1 entouré de noir, mais B2 est blanc : faux œil. Noir A2 et B1 sont deux chaînes, rien n'est dit.
    expect(unSeulOeil(pos([
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      'XXO......',
      'XO.......',
      '.XO......',
    ]), 1)).toBeNull();
  });
  it('lit aussi une liberté dehors coincée entre les murs', () => {
    // A2 B2 B1 C1 : œil en A1, dernière liberté en C2 ; Blanc qui joue C2 met en atari, puis prend.
    const m = unSeulOeil(pos([
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      'OOOO.....',
      'XX.O.....',
      '.XXO.....',
    ]), 1);
    expect(m?.type === 'un-oeil' && labels(m.oeil)).toEqual(['A1']);
  });
  it('ne regarde que les groupes du joueur', () => {
    expect(unSeulOeil(pos(unOeil), 2)).toBeNull();
  });
});

describe('prise ratée au coup précédent', () => {
  // Blanc E5 en atari (Noir D5, F5, E6) : Noir pouvait prendre en E4.
  const avant = pos([
    '.........',
    '.........',
    '.........',
    '....X....',
    '...XOX...',
    '.........',
    '.........',
    '.........',
    '.........',
  ]);
  it('signale la prise possible quand le joueur a joué ailleurs sans rien prendre', () => {
    const m = priseRatee(avant, jouer(avant, 'A1'), 1);
    expect(m).toEqual({ type: 'prise-ratee', point: fromLabel('E4', 9), pierres: [fromLabel('E5', 9)] });
  });
  it('se tait quand le joueur a pris', () => {
    expect(priseRatee(avant, jouer(avant, 'E4'), 1)).toBeNull();
  });
  it('se tait quand un groupe du joueur était en atari (il avait une raison de jouer ailleurs)', () => {
    const p = pos([
      'XO.......',
      '.........',
      '.........',
      '....X....',
      '...XOX...',
      '.........',
      '.........',
      '.........',
      '.........',
    ]);
    expect(priseRatee(p, jouer(p, 'H8'), 1)).toBeNull();
  });
  it('se tait pour une prise de ko (la pierre qui prend n’aurait qu’une liberté)', () => {
    const p = pos([
      'XXO......',
      'XO.O.....',
      'XXO......',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ]);
    expect(priseRatee(p, jouer(p, 'H8'), 1)).toBeNull();
  });
  it('se tait quand la prise est interdite par le ko', () => {
    const p = { ...pos([
      '.........',
      '.........',
      '.........',
      '....X....',
      '...XOX...',
      '.........',
      '.........',
      '.........',
      '.........',
    ]), ko: fromLabel('E4', 9) };
    expect(priseRatee(p, jouer(p, 'A1'), 1)).toBeNull();
  });
  it('se tait si ce n’était pas au joueur de jouer', () => {
    const p = { ...avant, toPlay: 2 as const };
    expect(priseRatee(p, jouer(p, 'A1'), 1)).toBeNull();
  });
});

describe('grande zone libre : un coin entier encore vide', () => {
  it('donne les bornes par taille', () => {
    expect(reglesZoneLibre(9)).toEqual({ cote: 5, minPierres: 6 });
    expect(reglesZoneLibre(13)).toEqual({ cote: 6, minPierres: 10 });
    expect(reglesZoneLibre(19)).toEqual({ cote: 7, minPierres: 16 });
    expect(reglesZoneLibre(7)).toBeNull();
  });
  const sixPierres = [
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '..XO.....',
    '..XO.....',
    '..XO.....',
    '.........',
  ];
  it('signale le coin vide (marge comprise), l’ouverture passée', () => {
    const m = zoneLibre(pos(sixPierres));
    expect(m?.type).toBe('zone-libre');
    if (m?.type !== 'zone-libre') return;
    expect(m.coin).toBe('hd');
    expect(m.zone).toHaveLength(16);
    expect(labels(m.zone)).toContain('G7');
  });
  it('choisit un autre coin quand le premier est pris (ordre : hd, bg, bd, hg)', () => {
    const p = pos(sixPierres);
    p.board[fromLabel('G7', 9)] = 2;
    p.board[fromLabel('C7', 9)] = 1;
    const m = zoneLibre(p);
    expect(m?.type === 'zone-libre' && m.coin).toBe('bd');
  });
  it('se tait si une pierre touche la marge du coin', () => {
    const p = pos(sixPierres);
    p.board[fromLabel('E7', 9)] = 1; // ligne qui borde le coin en haut à droite
    p.board[fromLabel('D7', 9)] = 2; // et celui en haut à gauche
    p.board[fromLabel('E4', 9)] = 1; // et celui en bas à droite (en bas à gauche : déjà C4)
    expect(zoneLibre(p)).toBeNull();
  });
  it('se tait en tout début de partie (moins de 6 pierres en 9 × 9)', () => {
    const p = pos(sixPierres);
    p.board[fromLabel('C2', 9)] = 0;
    expect(zoneLibre(p)).toBeNull();
    expect(zoneLibre(newPosition(9))).toBeNull();
  });
  it('se tait sur un plateau sans règle (7 × 7)', () => {
    const p = newPosition(7);
    for (const q of [8, 9, 10, 15, 16, 17]) p.board[q] = 1;
    expect(zoneLibre(p)).toBeNull();
  });
});

describe('partie réelle (#424, 9 × 9) rejouée coup par coup : chaque moment dit est vrai', () => {
  const coups = (COUPS_424.match(/../g) ?? []).map(c => (c === 'tt' ? -1 : (c.charCodeAt(1) - 97) * 9 + (c.charCodeAt(0) - 97)));
  const positions: Position[] = [newPosition(9)];
  for (const m of coups) {
    const r = play(positions[positions.length - 1], m);
    if (typeof r === 'string') throw new Error(r);
    positions.push(r);
  }
  const vus: { coup: number; m: MomentCoach }[] = [];
  // Noir (le joueur) au trait après la réponse de Blanc : positions d'indice pair, à partir de 2.
  for (let i = 2; i < positions.length; i += 2) {
    const [avantToi, apresToi, apresIa] = [positions[i - 2], positions[i - 1], positions[i]];
    for (const m of [atariNouveau(apresToi, apresIa, 1), unSeulOeil(apresIa, 1), priseRatee(avantToi, apresToi, 1), zoneLibre(apresIa)]) if (m) vus.push({ coup: i, m });
  }
  it('vérifie chaque affirmation sur la position', () => {
    for (const { coup, m } of vus) {
      const p = positions[coup];
      if (m.type === 'atari') expect(groupAt(p.board, 9, m.repere).liberties).toEqual(new Set([m.liberte]));
      if (m.type === 'prise-ratee') {
        const r = play(positions[coup - 2], m.point);
        expect(typeof r).not.toBe('string');
        if (typeof r !== 'string') expect(r.captures[1]).toBeGreaterThan(positions[coup - 2].captures[1]);
        expect(positions[coup - 1].captures[1]).toBe(positions[coup - 2].captures[1]);
      }
      if (m.type === 'zone-libre') expect(m.zone.every(q => p.board[q] === 0)).toBe(true);
      if (m.type === 'un-oeil') expect(m.pierres.every(q => p.board[q] === 1)).toBe(true);
    }
  });
  it('relève les moments attendus de cette partie', () => {
    expect(vus.map(({ coup, m }) => `${coup}:${m.type}`)).toMatchSnapshot();
  });
});

describe('parties au hasard (9 × 9) : chaque moment dit est vrai, et le calcul reste léger', () => {
  it('200 parties de 60 coups, graine fixe', () => {
    let graine = 470;
    const hasard = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let vus = 0, plusLong = 0;
    for (let partie = 0; partie < 200; partie++) {
      const ps: Position[] = [newPosition(9)];
      for (let k = 0; k < 60; k++) {
        const p = ps[ps.length - 1];
        let r: Position | string = 'occupe';
        for (let essai = 0; essai < 20 && typeof r === 'string'; essai++) r = play(p, Math.floor(hasard() * 81));
        ps.push(typeof r === 'string' ? (play(p, -1) as Position) : r);
      }
      for (let i = 2; i < ps.length; i += 2) {
        const t0 = performance.now();
        const ms = [atariNouveau(ps[i - 1], ps[i], 1), unSeulOeil(ps[i], 1), priseRatee(ps[i - 2], ps[i - 1], 1), zoneLibre(ps[i])];
        plusLong = Math.max(plusLong, performance.now() - t0);
        for (const m of ms) {
          if (!m) continue;
          vus++;
          const p = ps[i];
          if (m.type === 'atari') expect(groupAt(p.board, 9, m.repere).liberties.size).toBe(1);
          if (m.type === 'un-oeil') {
            expect(m.oeil.every(q => p.board[q] === 0)).toBe(true);
            expect(groupAt(p.board, 9, m.repere).stones.length).toBe(m.pierres.length);
          }
          if (m.type === 'prise-ratee') {
            const r = play(ps[i - 2], m.point);
            expect(typeof r !== 'string' && r.captures[1] > ps[i - 2].captures[1]).toBe(true);
          }
          if (m.type === 'zone-libre') expect(m.zone.every(q => p.board[q] === 0)).toBe(true);
        }
      }
    }
    expect(vus).toBeGreaterThan(50);
    expect(plusLong).toBeLessThan(200);
  });
});
