// #497 : faits de KataGo gardés avec une erreur (variante principale, riposte, zone). La position de Florian vient
// d'une vraie analyse du réseau g170-b6c96 (florian497.fixture.ts) ; les autres cas sont construits.
import { describe, expect, it } from 'vitest';
import { fromRows } from '../go/position';
import { fromLabel, toLabel } from '../go/coords';
import type { AnalyseRevue } from '../engine';
import { faitsKataGo, lireFaits, suiteLegale } from './faitsKataGo';
import { dansRegion, zoneKataGo } from './pourquoi';
import { FLORIAN_APRES, FLORIAN_AVANT } from './florian497.fixture';

const N = 9;
const L = (s: string) => fromLabel(s, N);
const Ls = (s: string) => s.split(' ').map(L);
const noms = (xs?: number[]) => xs?.map(p => toLabel(p, N)).join(' ');
function position(noires: string[], blanches: string[], toPlay: 1 | 2 = 1) {
  const rows = Array.from({ length: N }, () => '.'.repeat(N).split(''));
  for (const [liste, ch] of [[noires, 'X'], [blanches, 'O']] as const) for (const s of liste) { const p = L(s); rows[Math.floor(p / N)][p % N] = ch; }
  return fromRows(rows.map(r => r.join('')), toPlay).pos;
}
const FLORIAN = position(['C3', 'G7'], ['D5', 'C2']);

describe('la position de Florian, analysée par KataGo', () => {
  const f = faitsKataGo(FLORIAN, L('D3'), L('C4'), FLORIAN_AVANT, FLORIAN_APRES)!;

  it('variante principale du bon coup : celle de KataGo, raccourcie à 1 + 3 coups', () => {
    expect(noms(FLORIAN_AVANT.coups![0].pv)).toBe('D3 F4 D7 C7 C8 C6');
    expect(noms(f.suite)).toBe('D3 F4 D7 C7');
  });

  it('riposte : après C4, le premier choix de KataGo pour Blanc est E3 (puis E4, D4)', () => {
    expect(noms(f.riposte)).toBe('E3 E4 D4');
  });

  it('zone : l’écart se fait en bas (environ 4 points), et le total (3 points) est cohérent', () => {
    expect(f.zone).toMatchObject({ region: 'bas', gain: 4.2, total: 3 });
    expect(noms(f.zone!.points)).toBe('D4 E3 D2 E2 F2 C1 D1 E1');
    expect(f.zone!.points.every(p => dansRegion(p, N, 'bas') && FLORIAN.board[p] === 0)).toBe(true);
  });
});

describe('ce qui n’est pas gardé', () => {
  const k = (coups: AnalyseRevue['coups'], extra: Partial<AnalyseRevue> = {}): AnalyseRevue => ({ lead: 0, engine: 'katago', coups, ...extra });

  it('pas de variante ni de zone si le bon coup n’est pas le premier choix de KataGo, ou s’il est trop peu exploré', () => {
    const autre = faitsKataGo(FLORIAN, L('D4'), L('C4'), FLORIAN_AVANT, FLORIAN_APRES)!;
    expect(autre.suite).toBeUndefined();
    expect(autre.zone).toBeUndefined();
    expect(noms(autre.riposte)).toBe('E3 E4 D4');
    const peu = k([{ move: L('D3'), visits: 3, lead: 4, pv: Ls('D3 E3') }], { ownApres: FLORIAN_AVANT.ownApres });
    expect(faitsKataGo(FLORIAN, L('D3'), L('C4'), peu, null)).toBeUndefined();
  });

  it('suite coupée au premier coup illégal ou à la première passe', () => {
    expect(noms(suiteLegale(FLORIAN, Ls('D3 E3 E3 F3'), 10))).toBe('D3 E3');
    expect(noms(suiteLegale(FLORIAN, [L('D3'), -1, L('E3')], 10))).toBe('D3');
    const f = faitsKataGo(FLORIAN, L('D3'), L('C4'), k([{ move: L('D3'), visits: 30, lead: 4, pv: [L('D3'), L('C3')] }]), null);
    expect(f).toBeUndefined(); // une suite d'un seul coup n'illustre rien
  });

  it('moteur simple, ou analyses absentes : aucun fait', () => {
    expect(faitsKataGo(FLORIAN, L('D3'), L('C4'), { lead: 1, engine: 'simple' }, { lead: 1, engine: 'simple' })).toBeUndefined();
    expect(faitsKataGo(FLORIAN, L('D3'), L('C4'), null, undefined)).toBeUndefined();
  });

  it('zone : rien quand l’écart ne se concentre dans aucune région, ou quand la région gagne bien plus que le total', () => {
    const plat = (v: number) => new Float32Array(81).fill(v);
    expect(zoneKataGo(FLORIAN, L('D3'), L('C4'), plat(0.1), plat(0))).toBeNull(); // 8 points partout : aucune moitié n'en porte 60 %
    const bas = plat(0), haut = plat(0);
    for (let p = 0; p < 81; p++) { if (dansRegion(p, N, 'bas')) bas[p] = 0.5; if (dansRegion(p, N, 'haut')) haut[p] = 0.5; }
    // En bas +18 points, en haut -18 : total nul, on ne dit rien.
    expect(zoneKataGo(FLORIAN, L('D3'), L('C4'), bas, haut)).toBeNull();
    // Blanc au trait : le point de vue s'inverse.
    const z = zoneKataGo(position(['C3', 'G7'], ['D5', 'C2'], 2), L('D3'), L('C4'), plat(0), bas);
    expect(z?.region).toBe('bas');
  });
});

describe('relecture (localStorage)', () => {
  const f = faitsKataGo(FLORIAN, L('D3'), L('C4'), FLORIAN_AVANT, FLORIAN_APRES)!;

  it('aller-retour en JSON : identique', () => {
    expect(lireFaits(JSON.parse(JSON.stringify(f)), N)).toEqual(f);
  });

  it('chaque champ mal formé est écarté seul ; une zone incohérente aussi', () => {
    expect(lireFaits({ ...f, suite: [L('D3'), 81] }, N)).toEqual({ riposte: f.riposte, zone: f.zone });
    expect(lireFaits({ ...f, riposte: 'E3' }, N)).toEqual({ suite: f.suite, zone: f.zone });
    expect(lireFaits({ ...f, zone: { ...f.zone, region: 'milieu' } }, N)).toEqual({ suite: f.suite, riposte: f.riposte });
    expect(lireFaits({ ...f, zone: { ...f.zone, gain: 40 } }, N)).toEqual({ suite: f.suite, riposte: f.riposte });
    expect(lireFaits(null, N)).toBeUndefined();
    expect(lireFaits([1, 2], N)).toBeUndefined();
    expect(lireFaits({}, N)).toBeUndefined();
  });

  it('une suite plus longue que le réglage actuel est raccourcie, pas écartée', () => {
    expect(noms(lireFaits({ suite: Ls('D3 F4 D7 C7 E6 C5') }, N)!.suite)).toBe('D3 F4 D7 C7');
  });
});
