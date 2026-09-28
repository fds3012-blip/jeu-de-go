// Part de hasard des niveaux KataGo (#179) : tirage selon la politique du réseau, avec une température.
// Faux moteur : aucune inférence, le test reste rapide.
import { afterEach, describe, expect, it } from 'vitest';
import { bestMove, OPPONENTS, opponent, setKataGo, type Analysis, type KataGoBackend, type Opponent } from './index';
import { choisirCoup, coupSelonPolitique } from './katago/choose';
import { rng } from './sim';
import { newPosition, type Position } from '../go/rules';

const N = 9;
const at = (x: number, y: number) => y * N + x;

/** Position 9 × 9, Noir au trait : `b` et `w` listent les pierres. */
function position(b: number[], w: number[], lastMove: number | null = at(8, 0)): Position {
  const p = newPosition(N);
  for (const q of b) p.board[q] = 1;
  for (const q of w) p.board[q] = 2;
  return { ...p, toPlay: 1, lastMove };
}

// Noir a un œil en A9 (0, 0). Jouer E5 (4, 4) le met en atari : Blanc l'entoure sur trois côtés.
const OEIL = at(0, 0), AUTO_ATARI = at(4, 4), BON = at(6, 6), CORRECT = at(2, 6), ABSURDE = at(8, 8);
const POS = position([at(1, 0), at(0, 1), at(1, 1)], [at(4, 3), at(3, 4), at(5, 4)]);

/** Analyse factice : le meilleur coup de la recherche est BON, la politique est donnée à la main. */
function analyse(policy: Map<number, number>, best = BON): Analysis {
  const pol = new Float32Array(N * N + 1);
  let reste = 1;
  for (const v of policy.values()) reste -= v;
  // Le reste de la politique, étalé sur les autres points libres, sous le seuil « absurde ».
  const libres = [...Array(N * N).keys()].filter(p => !POS.board[p] && !policy.has(p));
  for (const p of libres) pol[p] = Math.min(reste / libres.length, 0.0005);
  for (const [m, v] of policy) pol[m < 0 ? N * N : m] = v;
  return {
    moves: [{ move: best, visits: 10, prior: 0.1, winrate: 0.6, lead: 3, scoreLoss: 0 }],
    winrate: 0.6, lead: 3, ownership: new Float32Array(N * N), visits: 10, ms: 1, engine: 'faux', policy: pol,
  };
}

function frequences(a: Analysis, temperature: number, n = 400, graine = 7): Map<number, number> {
  const rand = rng(graine), f = new Map<number, number>();
  for (let i = 0; i < n; i++) { const m = coupSelonPolitique(a, POS, temperature, rand); f.set(m, (f.get(m) ?? 0) + 1 / n); }
  return f;
}

describe('tirage selon la politique (#179)', () => {
  it("ne remplit jamais son propre œil, ne se met pas en atari, ne passe pas et évite les coups absurdes", () => {
    const a = analyse(new Map([[OEIL, 0.4], [AUTO_ATARI, 0.3], [-1, 0.1], [BON, 0.1], [CORRECT, 0.05], [ABSURDE, 0.0001]]));
    for (const t of [1, 2, 5]) {
      const f = frequences(a, t);
      expect([...f.keys()].sort((x, y) => x - y)).toEqual([CORRECT, BON].sort((x, y) => x - y));
    }
  });

  it('la température aplatit la politique', () => {
    const a = analyse(new Map([[BON, 0.8], [CORRECT, 0.1]]));
    const froid = frequences(a, 1).get(BON)!, chaud = frequences(a, 3).get(BON)!;
    expect(froid).toBeGreaterThan(0.8);
    expect(chaud).toBeLessThan(0.75);
  });

  it('reproductible avec une graine', () => {
    const a = analyse(new Map([[BON, 0.3], [CORRECT, 0.3], [at(2, 2), 0.3]]));
    const tirage = (g: number) => { const r = rng(g); return Array.from({ length: 20 }, () => coupSelonPolitique(a, POS, 1.5, r)); };
    expect(tirage(42)).toEqual(tirage(42));
    expect(new Set(tirage(42)).size).toBeGreaterThan(1);
  });

  it('sans politique : les priors de la recherche, jamais un coup absurde', () => {
    const a: Analysis = { ...analyse(new Map()), policy: undefined, moves: [
      { move: BON, visits: 5, prior: 0.5, winrate: 0.6, lead: 3, scoreLoss: 0 },
      { move: OEIL, visits: 5, prior: 0.5, winrate: 0.6, lead: 3, scoreLoss: 0 },
    ] };
    expect([...frequences(a, 1).keys()]).toEqual([BON]);
  });

  it("hasard 0 : toujours le choix habituel ; pas de hasard quand l'adversaire vient de passer", () => {
    const a = analyse(new Map([[CORRECT, 0.9]]));
    const katago = { visits: 4, tolerance: 0, style: 'solide' as const };
    const rand = rng(3);
    for (let i = 0; i < 50; i++) expect(choisirCoup(a, POS, { hasard: 0, katago }, rand)).toBe(BON);
    const passe = { ...POS, lastMove: -1 };
    for (let i = 0; i < 50; i++) expect(choisirCoup(a, passe, { hasard: 1, katago }, rand)).toBe(BON);
    // Hasard 1 : le tirage suit la politique (CORRECT domine).
    let correct = 0;
    for (let i = 0; i < 100; i++) if (choisirCoup(a, POS, { hasard: 1, katago }, rand) === CORRECT) correct++;
    expect(correct).toBeGreaterThan(90);
  });
});

describe('bestMove applique `hasard` aux niveaux KataGo (#179)', () => {
  afterEach(() => setKataGo(undefined));
  const faux = (a: Analysis): KataGoBackend => ({ info: { state: 'pret' } as KataGoBackend['info'], analyze: async () => a });

  it('tire selon la politique avec la graine, toujours le meilleur coup sans hasard', async () => {
    const a = analyse(new Map([[CORRECT, 0.45], [at(2, 2), 0.45]]));
    setKataGo(faux(a));
    const bambou = opponent('bambou');
    const sans: Opponent = { ...bambou, hasard: 0, katago: { ...bambou.katago!, tolerance: 0 } };
    const avec: Opponent = { ...bambou, hasard: 1, katago: { ...bambou.katago!, tolerance: 0 } };
    for (let s = 0; s < 10; s++) expect(await bestMove(POS, sans, { seed: s })).toBe(BON);
    const coups = await Promise.all(Array.from({ length: 20 }, (_, s) => bestMove(POS, avec, { seed: s })));
    expect(coups.every(m => m === CORRECT || m === at(2, 2))).toBe(true);
    expect(new Set(coups).size).toBe(2);
    // Même graine, même coup.
    expect(await bestMove(POS, avec, { seed: 5 })).toBe(coups[5]);
  });
});

describe('réglage de la part de hasard (#179, docs/game-design/equilibrage.md)', () => {
  it('Bambou et Renard jouent parfois un coup « humain », les niveaux suivants jamais', () => {
    const h = Object.fromEntries(OPPONENTS.map(o => [o.id, o.hasard]));
    expect(h.bambou).toBeGreaterThan(h.renard);
    expect(h.renard).toBeGreaterThan(0);
    for (const id of ['riviere', 'tigre', 'montagne', 'dragon', 'sensei'] as const) expect(h[id]).toBe(0);
  });
});
