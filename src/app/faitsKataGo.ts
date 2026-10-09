// #497 : faits de KataGo gardés avec une erreur de partie, pour expliquer le bon coup (src/app/pourquoi.ts) et
// illustrer « Revoir la suite ». Logique pure, testée dans faitsKataGo.test.ts.
//
// Règle d'or (Florian) : aucune explication fausse. On ne garde que ce que KataGo a vraiment calculé, contrôlé par les
// règles : variante principale du bon coup (seulement si le bon coup est son premier choix, bien exploré), riposte de
// l'adversaire après le coup joué (son premier choix, bien exploré), zone comparée (propriété estimée après le bon coup
// et après le coup joué). Chaque suite est rejouée coup par coup et coupée au premier coup illégal ou à la première passe.
import type { AnalyseRevue } from '../engine';
import { play, type Position } from '../go/rules';
import { REGIONS, RIPOSTE_MAX, SUITE_MAX, zoneDicible, zoneKataGo, type FaitsKataGo, type Region } from './pourquoi';
import { VISITES_MIN } from './revue';

/** Les coups de `coups` jouables l'un après l'autre depuis `depart` (sans passe), au plus `max`. */
export function suiteLegale(depart: Position, coups: readonly number[], max: number): number[] {
  const out: number[] = [];
  let pos = depart;
  for (const p of coups) {
    if (out.length >= max || !Number.isInteger(p) || p < 0) break;
    const r = play(pos, p);
    if (typeof r === 'string') break;
    out.push(p);
    pos = r;
  }
  return out;
}

const katago = (a: AnalyseRevue | null | undefined) => (a && a.engine === 'katago' ? a : null);

/**
 * Faits de KataGo pour l'erreur `joue` (-1 : passe) dans `avant`, dont le bon coup est `meilleur` :
 * - `analyseAvant` : analyse de `avant` (variante principale du meilleur coup, propriété après lui) ;
 * - `analyseApres` : analyse de la position après le coup joué (riposte de l'adversaire, propriété).
 * Rien n'est gardé si l'une des conditions manque. `undefined` : aucun fait.
 */
export function faitsKataGo(avant: Position, meilleur: number, joue: number,
  analyseAvant: AnalyseRevue | null | undefined, analyseApres: AnalyseRevue | null | undefined): FaitsKataGo | undefined {
  const f: FaitsKataGo = {};
  const av = katago(analyseAvant), ap = katago(analyseApres);
  const premier = av?.coups?.[0];
  const sur = !!premier && premier.move === meilleur && premier.visits >= VISITES_MIN;
  if (sur && premier.pv?.[0] === meilleur) {
    const suite = suiteLegale(avant, premier.pv, 1 + SUITE_MAX);
    if (suite.length >= 2) f.suite = suite;
  }
  const pj = play(avant, joue >= 0 ? joue : -1);
  const top = ap?.coups?.[0];
  if (typeof pj !== 'string' && top && top.move >= 0 && top.visits >= VISITES_MIN) {
    const riposte = suiteLegale(pj, top.pv?.[0] === top.move ? top.pv : [top.move], RIPOSTE_MAX);
    if (riposte.length) f.riposte = riposte;
  }
  if (sur && av?.ownApres && ap?.own) {
    const z = zoneKataGo(avant, meilleur, joue, av.ownApres, ap.own);
    if (z) f.zone = z;
  }
  return Object.keys(f).length ? f : undefined;
}

const indices = (v: unknown, n: number, max: number): number[] | null =>
  Array.isArray(v) && v.length <= max && v.every(p => Number.isInteger(p) && p >= 0 && p < n) ? (v as number[]) : null;

/**
 * Relit les faits gardés (localStorage) : ce qui est mal formé est écarté, champ par champ. `undefined` : rien de sûr.
 * Les suites restent recontrôlées par les règles quand on les joue (src/app/pourquoi.ts).
 */
export function lireFaits(brut: unknown, size: number): FaitsKataGo | undefined {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return undefined;
  const b = brut as Record<string, unknown>, n = size * size, f: FaitsKataGo = {};
  // Suites plus longues (réglage changé depuis) : raccourcies, pas écartées.
  const suite = indices(b.suite, n, 50)?.slice(0, 1 + SUITE_MAX), riposte = indices(b.riposte, n, 50)?.slice(0, RIPOSTE_MAX);
  if (suite && suite.length >= 2) f.suite = suite;
  if (riposte && riposte.length) f.riposte = riposte;
  const z = b.zone as Record<string, unknown> | undefined;
  if (z && typeof z === 'object' && typeof z.region === 'string' && REGIONS.includes(z.region as Region)
    && typeof z.gain === 'number' && typeof z.total === 'number') {
    const points = indices(z.points, n, n), zone = { region: z.region as Region, gain: z.gain, total: z.total, points: points ?? [] };
    if (points && zoneDicible(zone)) f.zone = zone;
  }
  return Object.keys(f).length ? f : undefined;
}
