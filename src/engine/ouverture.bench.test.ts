// Banc de l'issue #488 : premiers coups de Pomme et Caillou, et taux de victoire d'un débutant simulé contre Pomme,
// avec et sans le filtre des coups plausibles (src/engine/ouverture.ts). Désactivé par défaut (quelques minutes).
//   OUVERTURE_BENCH=1 npx vitest run src/engine/ouverture.bench.test.ts
// Variables : OUVERTURE_PARTIES (défaut 40 par paire), OUVERTURE_CAILLOU (parties Caillou contre Pomme, défaut 12),
// OUVERTURE_SORTIE (fichier JSON, une ligne par série), OUVERTURE_POMME (réglages essayés pour Pomme, JSON),
// OUVERTURE_QUAND (« avant » ou « apres » : une seule des deux séries contre les débutants),
// OUVERTURE_DEBUTANTS (indices des débutants simulés, ex. « 0,2 »), OUVERTURE_GRAINE (défaut 4880).
// Pomme joue avec un nombre fixe de simulations (250, sans plafond de temps) : les séries sont reproductibles.
import { appendFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { newPosition, play, type Color, type Position } from '../go/rules';
import { score } from '../go/score';
import { chooseMoveDetail, OPPONENTS, type Opponent } from './simple';
import { deadStones } from './dead';
import { isEye, rng } from './sim';
import { ligne } from './ouverture';

const actif = process.env.OUVERTURE_BENCH === '1';
const PARTIES = Number(process.env.OUVERTURE_PARTIES ?? 40);
const PARTIES_CAILLOU = Number(process.env.OUVERTURE_CAILLOU ?? 12);
const KOMI = 0.5; // premières parties (KOMI_DEBUTANT)
const MAX_COUPS = 200;
const SANS_LIMITE = 600_000;

const pommeReglee: Opponent = { ...OPPONENTS[0], ...(JSON.parse(process.env.OUVERTURE_POMME ?? '{}') as Partial<Opponent>) };
/** Pomme d'avant #488 : hasard 0,3, sans filtre. */
const ANCIENNE_POMME: Opponent = { ...OPPONENTS[0], hasard: 0.3, ouverture: false };
const POMME = { avant: ANCIENNE_POMME, apres: pommeReglee };
const CAILLOU = { avant: { ...OPPONENTS[1], ouverture: false }, apres: OPPONENTS[1] };

/** Débutants simulés (Noir). Tous gardent l'ancien comportement : le témoin ne bouge pas entre avant et après. */
type Joueur = { nom: string; coup: (pos: Position, graine: number) => number };
const auHasard: Joueur = {
  nom: 'débutant au hasard',
  coup(pos, graine) {
    const r = rng(graine), n = pos.size;
    const ok = [...pos.board.keys()].filter(p => !pos.board[p] && !isEye(pos.board, n, p, pos.toPlay) && typeof play(pos, p) !== 'string');
    return ok.length ? ok[Math.floor(r() * ok.length)] : -1;
  },
};
const moteur = (nom: string, lvl: Opponent, opts: { timeMs?: number; playouts?: number } = {}): Joueur => ({
  nom,
  coup: (pos, graine) => chooseMoveDetail(pos, lvl, { komi: KOMI, seed: graine, timeMs: SANS_LIMITE, ...opts }).move,
});
const GRAINE = Number(process.env.OUVERTURE_GRAINE ?? 4880);
const DEBUTANTS: Joueur[] = [
  auHasard,
  moteur('débutant Mochi doux (hasard 0,5)', { ...OPPONENTS[0], hasard: 0.5, ouverture: false }),
  moteur('débutant de la force de l’ancienne Pomme', ANCIENNE_POMME),
  moteur('débutant Mochi très doux (hasard 0,7)', { ...OPPONENTS[0], hasard: 0.7, ouverture: false }),
];

interface Partie { gagnant: Color; marge: number; coups: number; premiers: number[] }

function partie(noir: Joueur, blanc: Joueur, size: number, graine: number): Partie {
  let pos = newPosition(size), passes = 0, n = 0;
  const premiers: number[] = [];
  while (passes < 2 && n < MAX_COUPS) {
    const g = graine * 1000 + n;
    let m = pos.toPlay === 1 ? noir.coup(pos, g) : blanc.coup(pos, g);
    if (m >= 0 && typeof play(pos, m) === 'string') m = -1;
    if (pos.toPlay === 2 && m >= 0 && premiers.length < 3) premiers.push(ligne(m, size));
    if (m === -1) { passes++; pos = { ...pos, ko: -1, toPlay: (3 - pos.toPlay) as Color, lastMove: -1 }; }
    else { passes = 0; pos = play(pos, m) as Position; }
    n++;
  }
  const s = score(pos, KOMI, 'chinese', new Set(deadStones(pos, { seed: graine, playouts: 400, timeMs: SANS_LIMITE })));
  return { gagnant: s.winner as Color, marge: s.margin, coups: n, premiers };
}

function pommeJoueur(lvl: Opponent): Joueur {
  return { nom: lvl.id, coup: (pos, g) => chooseMoveDetail(pos, lvl, { komi: KOMI, seed: g, timeMs: SANS_LIMITE, playouts: 250, accommodant: true }).move };
}

function resume(nom: string, parties: Partie[], fort: Color) {
  const v = parties.filter(p => p.gagnant === fort).length;
  const ecart = parties.reduce((s, p) => s + (p.gagnant === fort ? p.marge : -p.marge), 0) / parties.length;
  const pp = parties.map(p => p.premiers[0]).filter(x => x !== undefined);
  const tous = parties.flatMap(p => p.premiers);
  const bord = (l: number[], k: number) => l.filter(x => x <= k).length;
  return {
    serie: nom, parties: parties.length, victoiresDuPlusFort: v, taux: +(v / parties.length).toFixed(3), ecartMoyen: +ecart.toFixed(1),
    premierCoup1reLigne: bord(pp, 1), premierCoup2eLigneOuMoins: bord(pp, 2), premiersCoups: pp.length,
    troisPremiers1reLigne: bord(tous, 1), troisPremiers2eLigneOuMoins: bord(tous, 2), troisPremiers: tous.length,
  };
}

/** Rend la main à Vitest entre deux parties (sinon ses messages internes expirent pendant les longues séries). */
const pause = () => new Promise(r => setTimeout(r, 0));
async function serie(n: number, f: (i: number) => Partie): Promise<Partie[]> {
  const out: Partie[] = [];
  for (let i = 0; i < n; i++) { out.push(f(i)); await pause(); }
  return out;
}

function ecrire(r: object) {
  console.info(JSON.stringify(r));
  if (process.env.OUVERTURE_SORTIE) appendFileSync(process.env.OUVERTURE_SORTIE, JSON.stringify({ ...r, date: '2026-10-08' }) + '\n');
}

describe.skipIf(!actif)('banc #488 : ouverture de Pomme', () => {
  it('débutants simulés contre Pomme, avant / après (9 × 9, komi 0,5)', async () => {
    const choix = process.env.OUVERTURE_DEBUTANTS?.split(',').map(Number);
    for (const d of DEBUTANTS.filter((_, i) => !choix || choix.includes(i))) {
      for (const [quand, lvl] of Object.entries(POMME)) {
        if (process.env.OUVERTURE_QUAND && process.env.OUVERTURE_QUAND !== quand) continue;
        const ps = await serie(PARTIES, i => partie(d, pommeJoueur(lvl), 9, GRAINE + i));
        ecrire({ ...resume(`${d.nom} contre Pomme (${quand})`, ps, 2), reglages: quand === 'apres' ? process.env.OUVERTURE_POMME ?? 'actuel' : 'sans filtre', graine: GRAINE });
      }
    }
  }, 3_600_000);

  it('premiers coups sur 13 × 13 (Pomme et Caillou, avant / après, contre un débutant au hasard)', () => {
    for (const [nom, paire] of [['Pomme', POMME], ['Caillou', CAILLOU]] as const) {
      for (const [quand, lvl] of Object.entries(paire)) {
        const premiers: number[] = [];
        for (let i = 0; i < 20; i++) {
          let pos = newPosition(13);
          for (let k = 0; k < 6; k++) {
            const m = pos.toPlay === 1 ? auHasard.coup(pos, 13000 + i * 100 + k)
              : chooseMoveDetail(pos, lvl, { komi: KOMI, seed: 13000 + i * 100 + k, ...(nom === 'Pomme' ? { timeMs: SANS_LIMITE, playouts: 250 } : {}) }).move;
            if (pos.toPlay === 2 && m >= 0) premiers.push(ligne(m, 13));
            pos = m >= 0 ? (play(pos, m) as Position) : (play(pos, -1) as Position);
          }
        }
        ecrire({ serie: `${nom} 13 × 13 (${quand}) : 3 premiers coups`, coups: premiers.length, ligne1: premiers.filter(l => l === 1).length, ligne2: premiers.filter(l => l === 2).length, lignes: premiers.join('') });
      }
    }
  }, 3_600_000);

  it('Caillou contre Pomme, avant / après (proxy de l’échelle, 9 × 9) et premiers coups de Caillou', async () => {
    for (const quand of ['avant', 'apres'] as const) {
      const caillou = moteur('caillou', CAILLOU[quand], { timeMs: OPPONENTS[1].timeMs });
      const pomme = pommeJoueur(POMME[quand]);
      // Couleurs alternées ; on compte les victoires de Caillou, et les premiers coups de celui qui a Blanc.
      const blancs: string[] = [];
      const ps = (await serie(PARTIES_CAILLOU, i => {
        const caillouNoir = i % 2 === 0, p = partie(caillouNoir ? caillou : pomme, caillouNoir ? pomme : caillou, 9, 7000 + i);
        blancs.push(caillouNoir ? 'pomme' : 'caillou');
        return { ...p, gagnant: (p.gagnant === (caillouNoir ? 1 : 2) ? 2 : 1) as Color };
      })).map((p, i) => ({ ...p, blancEst: blancs[i] }));
      ecrire(resume(`Caillou contre Pomme (${quand}), victoires de Caillou`, ps, 2));
      ecrire(resume(`Premiers coups de Caillou en Blanc (${quand})`, ps.filter(p => p.blancEst === 'caillou'), 2));
    }
  }, 3_600_000);
});
