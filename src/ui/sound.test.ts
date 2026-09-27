import { afterEach, describe, expect, it, vi } from 'vitest';
import { panFor, pileClicks, pitchFactor, playStone, shouldPlay, unlockAudio } from './sound';
import { VIBRATIONS, hapticCapture, hapticStone, vibrate } from './haptics';

describe('panoramique', () => {
  it('va de −0,15 à +0,15 selon la colonne', () => {
    expect(panFor(0, 9)).toBeCloseTo(-0.15);
    expect(panFor(4, 9)).toBeCloseTo(0);
    expect(panFor(8, 9)).toBeCloseTo(0.15);
    expect(panFor(18, 19)).toBeCloseTo(0.15);
    expect(panFor(3, 19)).toBeCloseTo((3 / 18 - 0.5) * 0.3);
    expect(panFor(0, 1)).toBe(0);
  });
});

describe('anti-répétition', () => {
  it('bloque le même son pendant 50 ms, pas les autres', () => {
    const last = new Map<string, number>();
    expect(shouldPlay(last, 'pose', 1000)).toBe(true);
    expect(shouldPlay(last, 'pose', 1030)).toBe(false);
    expect(shouldPlay(last, 'capture', 1030)).toBe(true);
    expect(shouldPlay(last, 'pose', 1049)).toBe(false);
    expect(shouldPlay(last, 'pose', 1050)).toBe(true);
  });
  it('un son bloqué ne repousse pas la fenêtre', () => {
    const last = new Map<string, number>();
    shouldPlay(last, 'pose', 0);
    shouldPlay(last, 'pose', 40);
    expect(shouldPlay(last, 'pose', 55)).toBe(true);
  });
});

describe('hauteur et captures', () => {
  it('hauteur à ±3 %', () => {
    expect(pitchFactor(0)).toBeCloseTo(0.97);
    expect(pitchFactor(0.5)).toBeCloseTo(1);
    expect(pitchFactor(0.9999)).toBeCloseTo(1.03, 3);
  });
  it('un son par taille de capture : 1, 2, puis un tas', () => {
    expect([0, 1, 2, 3, 7].map(pileClicks)).toEqual([0, 1, 2, 4, 4]);
  });
});

describe('sans Web Audio ni vibration (Node, Safari iOS)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('les sons sont ignorés sans erreur', () => {
    expect(() => { unlockAudio(); playStone(40, 9); }).not.toThrow();
  });
  it('la vibration est ignorée sans erreur', () => {
    vi.stubGlobal('navigator', {});
    expect(vibrate(12)).toBe(false);
  });
  it('la vibration utilise les motifs prévus', () => {
    const v = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: v });
    hapticStone(); hapticCapture();
    expect(v).toHaveBeenNthCalledWith(1, 12);
    expect(v).toHaveBeenNthCalledWith(2, [20, 40, 20]);
    expect(VIBRATIONS.interdit).toBe(30);
  });
});
