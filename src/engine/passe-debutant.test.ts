// Premières parties (#235) : le débutant passe tôt, les frontières sont ouvertes partout. Pomme ne profite pas des
// passes : elle ne ferme qu'un trou dans SA frontière, une fois, puis elle passe. Indicateurs de l'issue :
// au plus 2 passes du joueur, et un écart final proche de celui de la position au moment où le joueur a passé.
import { describe, expect, it } from 'vitest';
import { chooseMoveDetail, deadStones, opponent } from './index';
import { reponseAccommodante } from './simple';
import { brecheAFermer, frontieresOuvertes, partieAvancee } from '../go/frontieres';
import { score } from '../go/score';
import { newPosition, play, type Color, type Position } from '../go/rules';
import { isEye, rng } from './sim';

function lire(rows: string[], toPlay: Color, lastMove: number | null = -1): Position {
  const size = rows.length, pos = newPosition(size);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') pos.board[y * size + x] = ch === 'X' ? 1 : 2; }));
  return { ...pos, toPlay, lastMove };
}

/** Avance de Blanc (komi 0,5, compte japonais, pierres mortes estimées) : ce que dirait l'écran de fin. */
function avanceBlanc(pos: Position, seed: number): number {
  const d = deadStones(pos, { seed, playouts: 400, timeMs: 60_000 });
  const s = score(pos, 0.5, 'japanese', new Set(d));
  return s.white - s.black;
}

/**
 * Partie scriptée : Noir (le débutant) joue des coups au hasard (jamais dans ses yeux), Blanc est Pomme ; après `plis`
 * coups, Noir passe, puis répond « Passer » à chaque coup de Pomme. Renvoie les passes de Noir et les écarts.
 */
function partie(plis: number, seed: number, accommodant = true) {
  const r = rng(seed * 7919 + 1);
  let pos = newPosition(9);
  for (let i = 0; i < plis; i++) {
    let m = -1;
    if (pos.toPlay === 1) {
      const vides = [...pos.board.keys()].filter(p => !pos.board[p] && !isEye(pos.board, 9, p, 1) && typeof play(pos, p) !== 'string');
      if (vides.length) m = vides[Math.floor(r() * vides.length)];
    } else m = chooseMoveDetail(pos, 'pomme', { seed: seed + i, komi: 0.5, timeMs: 60_000, playouts: 250, accommodant }).move;
    const q = play(pos, m);
    pos = typeof q === 'string' ? (play(pos, -1) as Position) : q;
  }
  if (pos.toPlay !== 1) pos = play(pos, chooseMoveDetail(pos, 'pomme', { seed, komi: 0.5, timeMs: 60_000, playouts: 250 }).move) as Position;
  const avant = avanceBlanc(pos, seed);
  let passes = 0, coupsGratuits = 0;
  for (let i = 0; i < 20; i++) {
    pos = play(pos, -1) as Position; passes++;
    const c = chooseMoveDetail(pos, 'pomme', { seed: seed + 100 + i, komi: 0.5, timeMs: 60_000, playouts: 250, accommodant, passesJoueur: passes });
    if (c.move === -1) break;
    coupsGratuits++;
    pos = play(pos, c.move) as Position;
  }
  return { passes, coupsGratuits, avant, apres: avanceBlanc(pos, seed), ouverts: frontieresOuvertes(pos.board, 9).length };
}

describe('le débutant passe tôt (#235)', () => {
  it('parties scriptées : au plus 2 passes, et Pomme ne gagne presque rien pendant les passes', () => {
    const lignes: string[] = [];
    for (const plis of [24, 32, 40]) {
      for (const seed of [1, 2, 3, 4]) {
        const p = partie(plis, seed);
        lignes.push(`${plis} coups, graine ${seed} : ${p.passes} passes, ${p.coupsGratuits} coup(s) de Pomme, écart ${p.avant} → ${p.apres}`);
        expect(p.passes, lignes.at(-1)).toBeLessThanOrEqual(2);
        expect(p.coupsGratuits).toBeLessThanOrEqual(1);
        // Un trou fermé ne rapporte que la zone qu'il protège : quelques points, jamais une invasion.
        expect(p.apres - p.avant, lignes.at(-1)).toBeLessThanOrEqual(12);
      }
    }
    console.log(lignes.join('\n'));
  }, 120_000);

  it('plateau ouvert partout : Pomme ne joue pas chez le joueur', () => {
    // Noir a passé au coup 24 : les deux camps sont esquissés, rien n'est fermé.
    const pos = lire([
      '.........',
      '..X...O..',
      '.........',
      '..X...O..',
      '....X....',
      '..X...O..',
      '.........',
      '..X...O..',
      '.........',
    ], 2);
    expect(partieAvancee(pos.board)).toBe(false);
    expect(chooseMoveDetail(pos, 'pomme', { seed: 1, accommodant: true }).move).toBe(-1);
  });

  it('un trou dans sa frontière : Pomme le ferme, puis elle passe', () => {
    // Mur blanc en colonne F avec un trou en F5 ; mur noir en colonne D. Le côté droit n'est à Blanc que si F5 est fermé.
    const rows = [
      '...XXO...',
      '...XXO...',
      '...XXO...',
      '...XXO...',
      '...XX....',
      '...XXO...',
      '...XXO...',
      '...XXO...',
      '...XXO...',
    ];
    const pos = lire(rows, 2);
    const f5 = 4 * 9 + 5;
    expect(brecheAFermer(pos)).toBe(f5);
    const r = chooseMoveDetail(pos, 'pomme', { seed: 1, accommodant: true, passesJoueur: 1 });
    expect(r.move).toBe(f5);
    expect(r.raison?.texte).toBe('il reste un trou dans sa frontière en F5');
    // Deuxième passe du joueur : Pomme passe, même s'il restait autre chose à fermer.
    expect(chooseMoveDetail(pos, 'pomme', { seed: 1, accommodant: true, passesJoueur: 2 }).move).toBe(-1);
    // Après la fermeture, plus de trou chez elle : elle passe.
    const ferme = play(play(pos, f5) as Position, -1) as Position;
    expect(chooseMoveDetail(ferme, 'pomme', { seed: 1, accommodant: true, passesJoueur: 1 }).move).toBe(-1);
  });

  it('le trou du joueur ne la concerne pas : elle ne le bouche pas', () => {
    // Même position vue de l'autre côté : le trou est dans le mur NOIR (D5). Blanc a son côté fermé.
    const pos = lire([
      '...XO....',
      '...XO....',
      '...XO....',
      '...XO....',
      '.....O...',
      '...XO....',
      '...XO....',
      '...XO....',
      '...XO....',
    ], 2);
    expect(brecheAFermer(pos)).toBe(-1);
    expect(chooseMoveDetail(pos, 'pomme', { seed: 1, accommodant: true }).move).toBe(-1);
  });

  it('niveau sans fermeture de frontières : passe tout de suite', () => {
    const pos = lire(['...XXO...', '...XXO...', '...XXO...', '...XXO...', '...XX....', '...XXO...', '...XXO...', '...XXO...', '...XXO...'], 2);
    const lvl = { ...opponent('pomme'), fermeFrontieres: false };
    expect(reponseAccommodante(pos, lvl, { accommodant: true }, () => []).move).toBe(-1);
  });
});
