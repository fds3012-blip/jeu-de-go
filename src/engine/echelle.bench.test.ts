// Banc d'essai de l'échelle des 9 adversaires (issue #179) : les adversaires jouent entre eux sur 9 × 9.
// Désactivé par défaut (trop long pour la CI). Pour le lancer :
//   npm run fetch-model
//   npm i --no-save @tensorflow/tfjs-node   (conseillé : sans lui, une partie de Sensei prend plus d'une heure)
//   ECHELLE_BENCH=1 npx vitest run src/engine/echelle.bench.test.ts
// Variables :
//   ECHELLE_PAIRES   paires d'indices (0 = Pomme … 8 = Sensei), ex. "0-1,1-2" ; par défaut, les 8 marches voisines
//   ECHELLE_PARTIES  parties par paire, couleurs alternées (défaut 4)
//   ECHELLE_GRAINE   graine de départ (défaut 179)
//   ECHELLE_SORTIE   fichier JSON où ajouter une ligne par partie (facultatif)
//   ECHELLE_REGLAGES réglages essayés à la place de ceux de simple.ts, en JSON, ex. '{"bambou":{"katago":{"visits":1,"tolerance":30}}}'
// Les niveaux KataGo jouent comme `bestMove` (recherche, tolérance, style, fermeture des frontières),
// sans le plafond de 1,8 s par coup : on mesure le réglage nominal, pas la vitesse de l'appareil.
// Le moteur simple garde son budget de temps réel (Pomme 150 ms, Caillou 600 ms) : la graine fixe le hasard,
// pas le nombre de simulations, donc deux lancers peuvent différer un peu.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { play, newPosition, type Position } from '../go/rules';
import { score } from '../go/score';
import { mortesSelonPropriete } from '../go/estimation';
import { coupDeFermeture, partieAvancee } from '../go/frontieres';
import { chooseMove, isLegalMove, OPPONENTS, type Opponent } from './simple';
import { rng } from './sim';
import { choisirCoup } from './katago/choose';
import { gunzip, parseNet } from './katago/parse';
import { TfNet } from './katago/net';
import { search } from './katago/search';

const file = fileURLToPath(new URL('../../public/models/g170-b6c96-s175395328-d26788732.bin.gz', import.meta.url));
const actif = process.env.ECHELLE_BENCH === '1' && existsSync(file);

const KOMI = 6.5;
const TAILLE = 9;
const MAX_COUPS = 160;

export interface Resultat { noir: string; blanc: string; gagnant: string; marge: number; coups: number; graine: number }

async function coup(net: TfNet, pos: Position, lvl: Opponent, rand: () => number, graine: number): Promise<number> {
  if (lvl.katago) {
    const a = await search(net, pos, { komi: KOMI, visits: lvl.katago.visits });
    // Même choix que `bestMove`, part de hasard comprise (tirage selon la politique, #179).
    let m = choisirCoup(a, pos, { hasard: lvl.hasard, katago: lvl.katago }, rand);
    if (m === -1 && lvl.fermeFrontieres && partieAvancee(pos.board)) {
      const f = coupDeFermeture(pos, mortesSelonPropriete(pos, a.ownership), a.moves.map(x => x.move));
      if (f >= 0) m = f;
    }
    return isLegalMove(pos, m) ? m : -1;
  }
  const m = chooseMove(pos, lvl, { komi: KOMI, seed: graine });
  return isLegalMove(pos, m) ? m : -1;
}

/** Une partie complète : deux passes (ou MAX_COUPS), puis comptage chinois, pierres mortes selon KataGo. */
async function partie(net: TfNet, noir: Opponent, blanc: Opponent, graine: number): Promise<Resultat> {
  let pos = newPosition(TAILLE);
  const rand = rng(graine);
  let passes = 0, n = 0;
  while (passes < 2 && n < MAX_COUPS) {
    const lvl = pos.toPlay === 1 ? noir : blanc;
    const m = await coup(net, pos, lvl, rand, graine * 1000 + n);
    if (m === -1) { passes++; pos = { ...pos, ko: -1, toPlay: (3 - pos.toPlay) as 1 | 2, lastMove: -1 }; }
    else { passes = 0; const r = play(pos, m); if (typeof r === 'string') throw new Error(r); pos = r; }
    n++;
    // Rend la main à Vitest entre deux coups (sinon ses messages internes expirent pendant les longues parties).
    await new Promise(r => setTimeout(r, 0));
  }
  const fin = await search(net, pos, { komi: KOMI, visits: 16 });
  const s = score(pos, KOMI, 'chinese', new Set(mortesSelonPropriete(pos, fin.ownership)));
  return { noir: noir.id, blanc: blanc.id, gagnant: s.winner === 1 ? noir.id : blanc.id, marge: s.margin, coups: n, graine };
}

/** Échelle jouée : OPPONENTS, avec les réglages d'essai de ECHELLE_REGLAGES fusionnés niveau par niveau. */
function echelle(): Opponent[] {
  const essai = JSON.parse(process.env.ECHELLE_REGLAGES ?? '{}') as Record<string, Partial<Opponent>>;
  return OPPONENTS.map(o => {
    const e = essai[o.id];
    if (!e) return o;
    return { ...o, ...e, katago: o.katago || e.katago ? { ...o.katago!, ...e.katago } : undefined };
  });
}

function paires(): [number, number][] {
  const env = process.env.ECHELLE_PAIRES;
  if (!env) return OPPONENTS.slice(1).map((_, i) => [i, i + 1]);
  return env.split(',').map(s => s.split('-').map(Number) as [number, number]);
}

describe.skipIf(!actif)("Échelle des 9 adversaires (banc d'essai, ECHELLE_BENCH=1)", () => {
  let net: TfNet;
  beforeAll(async () => {
    const tf = await import('@tensorflow/tfjs');
    // TensorFlow natif s'il est installé à part (npm i --no-save @tensorflow/tfjs-node) : 30 fois plus rapide.
    const natif = '@tensorflow/tfjs-node';
    try { await import(/* @vite-ignore */ natif); await tf.setBackend('tensorflow'); } catch { await tf.setBackend('cpu'); }
    console.log(`Backend TensorFlow.js : ${tf.getBackend()}`);
    net = new TfNet(tf, parseNet(await gunzip(new Uint8Array(readFileSync(file)))));
  }, 60000);

  it('fait jouer les paires demandées', async () => {
    const parties = Number(process.env.ECHELLE_PARTIES ?? 4), graine0 = Number(process.env.ECHELLE_GRAINE ?? 179);
    const sortie = process.env.ECHELLE_SORTIE;
    for (const [i, j] of paires()) {
      const liste = echelle(), a = liste[i], b = liste[j];
      let victoiresB = 0, ecart = 0;
      for (let k = 0; k < parties; k++) {
        const graine = graine0 + 97 * i + 13 * j + k;
        const [noir, blanc] = k % 2 === 0 ? [a, b] : [b, a];
        const t0 = Date.now();
        const r = await partie(net, noir, blanc, graine);
        if (r.gagnant === b.id) victoiresB++;
        ecart += r.gagnant === b.id ? r.marge : -r.marge;
        if (sortie) appendFileSync(sortie, JSON.stringify(r) + '\n');
        console.log(`${noir.nom} (N) – ${blanc.nom} (B) : ${r.gagnant} +${r.marge} en ${r.coups} coups, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
      console.log(`${b.nom} contre ${a.nom} : ${victoiresB}/${parties}, écart moyen ${(ecart / parties).toFixed(1)} pts`);
    }
  }, 24 * 3600 * 1000);
});
