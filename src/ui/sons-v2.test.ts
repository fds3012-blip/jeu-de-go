// #165 : chaque événement déclenche son son et sa vibration ; rien quand le réglage est coupé.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { geste, playAtari, playBadge, playCapture, playDefeat, playFail, playIllegal, playLevel, playStone, playSuccess, playVictory, setSoundEnabled, synth } from './sound';
import {
  VIBRATIONS, hapticAtari, hapticBadge, hapticCapture, hapticDefeat, hapticFail, hapticIllegal, hapticLevel, hapticStone,
  hapticSuccess, hapticVictory, setHapticsEnabled,
} from './haptics';

// Faux contexte Web Audio : juste ce qu'il faut pour que la synthèse passe, en comptant les sources créées.
let sources = 0;
const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
const noeud = () => { const n = { connect: (d: unknown) => d ?? n, gain: param(), frequency: param(), Q: param(), pan: param(), threshold: param(), knee: param(), ratio: param(), type: '' }; return n; };
class FauxContexte {
  state = 'running'; currentTime = 0; sampleRate = 8000; destination = noeud();
  createGain() { return noeud(); }
  createBiquadFilter() { return noeud(); }
  createStereoPanner() { return noeud(); }
  createDynamicsCompressor() { return noeud(); }
  createOscillator() { sources++; return { ...noeud(), start: vi.fn(), stop: vi.fn() }; }
  createBufferSource() { sources++; return { ...noeud(), buffer: null, start: vi.fn(), stop: vi.fn() }; }
  createBuffer(_c: number, n: number) { const d = new Float32Array(n); return { getChannelData: () => d }; }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
}

let horloge = 0;
beforeAll(() => {
  vi.stubGlobal('window', { AudioContext: FauxContexte });
  // L'anti-répétition (50 ms) ne doit pas masquer un son entre deux tests.
  vi.spyOn(performance, 'now').mockImplementation(() => (horloge += 1000));
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const EVENEMENTS = [
  { nom: 'pose', jouer: () => playStone(40, 9), vibrer: hapticStone, motif: VIBRATIONS.pose },
  { nom: 'pose', jouer: () => playStone(40, 9, true), vibrer: hapticStone, motif: VIBRATIONS.pose },
  { nom: 'capture', jouer: () => playCapture(2), vibrer: hapticCapture, motif: VIBRATIONS.capture },
  { nom: 'atari', jouer: playAtari, vibrer: hapticAtari, motif: VIBRATIONS.atari },
  { nom: 'interdit', jouer: playIllegal, vibrer: hapticIllegal, motif: VIBRATIONS.interdit },
  { nom: 'victoire', jouer: playVictory, vibrer: hapticVictory, motif: VIBRATIONS.victoire },
  { nom: 'defaite', jouer: playDefeat, vibrer: hapticDefeat, motif: VIBRATIONS.defaite },
  { nom: 'niveau', jouer: playLevel, vibrer: hapticLevel, motif: VIBRATIONS.niveau },
  { nom: 'badge', jouer: playBadge, vibrer: hapticBadge, motif: VIBRATIONS.badge },
  { nom: 'reussite', jouer: playSuccess, vibrer: hapticSuccess, motif: VIBRATIONS.reussite },
  { nom: 'echec', jouer: playFail, vibrer: hapticFail, motif: VIBRATIONS.echec },
] as const;

describe('sons : chaque événement a le sien', () => {
  beforeEach(() => { setSoundEnabled(true); sources = 0; });
  for (const e of EVENEMENTS) {
    it(`${e.nom} : la bonne synthèse, avec des sources audio`, () => {
      const espion = vi.spyOn(synth, e.nom);
      e.jouer();
      expect(espion).toHaveBeenCalledTimes(1);
      expect(sources).toBeGreaterThan(0);
      espion.mockRestore();
    });
    it(`${e.nom} : rien quand le son est coupé`, () => {
      setSoundEnabled(false);
      const espion = vi.spyOn(synth, e.nom);
      e.jouer();
      expect(espion).not.toHaveBeenCalled();
      expect(sources).toBe(0);
      espion.mockRestore();
    });
  }
});

describe('vibrations : un motif par événement, réglable à part', () => {
  const vibre = vi.fn((_p: number | number[]) => true);
  beforeEach(() => { vibre.mockClear(); vi.stubGlobal('navigator', { vibrate: vibre }); setHapticsEnabled(true); });
  for (const e of EVENEMENTS) {
    it(`${e.nom} : son motif, rien quand les vibrations sont coupées`, () => {
      e.vibrer();
      expect(vibre).toHaveBeenCalledWith(typeof e.motif === 'number' ? e.motif : [...e.motif]);
      setHapticsEnabled(false);
      vibre.mockClear();
      expect(e.vibrer()).toBe(false);
      expect(vibre).not.toHaveBeenCalled();
    });
  }
  it('couper le son ne coupe pas les vibrations (et inversement)', () => {
    setSoundEnabled(false);
    hapticStone();
    expect(vibre).toHaveBeenCalledTimes(1);
    setSoundEnabled(true); setHapticsEnabled(false); sources = 0;
    playStone(40, 9);
    expect(sources).toBeGreaterThan(0);
  });
  it('les motifs restent brefs : moins de 250 ms, jamais en continu', () => {
    for (const m of Object.values(VIBRATIONS)) {
      const total = typeof m === 'number' ? m : m.reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(250);
    }
  });
});

describe('pierre sur le kaya : jamais mécanique', () => {
  it('geste humain : force 0,86 à 1, clarté ±8 %, tenue ±10 %', () => {
    expect(geste(0, 0, 0)).toEqual({ force: 0.86, clarte: 0.92, tenue: 0.9 });
    const m = geste(0.5, 0.5, 0.5);
    expect(m.force).toBeCloseTo(0.93); expect(m.clarte).toBeCloseTo(1); expect(m.tenue).toBeCloseTo(1);
    const h = geste(0.9999, 0.9999, 0.9999);
    expect(h.force).toBeCloseTo(1, 3); expect(h.clarte).toBeCloseTo(1.08, 3); expect(h.tenue).toBeCloseTo(1.1, 3);
  });
  it('deux poses de suite ne reçoivent jamais la même hauteur ni le même geste', () => {
    setSoundEnabled(true);
    const espion = vi.spyOn(synth, 'pose');
    playStone(40, 9); playStone(41, 9);
    const [a, b] = espion.mock.calls;
    expect(a[3]).not.toBe(b[3]); // claquement (variante) différent
    expect(a[4]).not.toBe(b[4]); // hauteur différente
    expect(a[7]).not.toEqual(b[7]);
    espion.mockRestore();
  });
});
