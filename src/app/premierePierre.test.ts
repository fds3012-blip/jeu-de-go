// #487 (P9) : accueil épuré jusqu'à la première pierre posée sur l'appareil.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENEMENT_PREMIERE_PIERRE, PREMIERE_PIERRE_KEY, abonnerPierre, accueilEpure, lireRepere, noterPierrePosee, oublierRepere, pierreDejaPosee } from './premierePierre';

function stockage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((k: string) => m.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => { m.set(k, v); }),
    m,
  };
}

afterEach(() => { oublierRepere(); vi.unstubAllGlobals(); });

describe('pierre déjà posée', () => {
  it('appareil neuf : aucune pierre', () => {
    expect(pierreDejaPosee(false, [null, null, {}, { l1: 0 }])).toBe(false);
  });

  it('le repère suffit', () => {
    expect(pierreDejaPosee(true, [null, null])).toBe(true);
  });

  it('un appareil d’avant le repère (leçon, problème, série, placement) compte comme « pierre posée »', () => {
    expect(pierreDejaPosee(false, [{ l1: 2 }])).toBe(true);
    expect(pierreDejaPosee(false, [null, { b1: true }])).toBe(true);
    expect(pierreDejaPosee(false, [{ dernier: 3, jours: 1 }])).toBe(true);
    expect(pierreDejaPosee(false, [{ fait: false, saute: true, date: '2026-10-01' }])).toBe(true);
  });
});

describe('accueil épuré', () => {
  it('seulement au tout premier lancement, tant qu’aucune pierre n’est posée', () => {
    expect(accueilEpure({ nouveau: true, pierre: false })).toBe(true);
    expect(accueilEpure({ nouveau: true, pierre: true })).toBe(false);
  });

  it('jamais après une partie lancée (#432 intacte : « Jouer en ligne » reste l’action principale)', () => {
    expect(accueilEpure({ nouveau: false, pierre: false })).toBe(false);
    expect(accueilEpure({ nouveau: false, pierre: true })).toBe(false);
  });
});

describe('repère de la première pierre', () => {
  it('écrit une seule fois, puis ne touche plus au stockage', () => {
    const s = stockage();
    expect(lireRepere(s)).toBe(false);
    noterPierrePosee(s);
    noterPierrePosee(s);
    noterPierrePosee(s);
    expect(s.setItem).toHaveBeenCalledTimes(1);
    expect(s.m.get(PREMIERE_PIERRE_KEY)).toBe('true');
    expect(lireRepere(s)).toBe(true);
  });

  it('relu depuis l’appareil', () => {
    expect(lireRepere(stockage({ [PREMIERE_PIERRE_KEY]: 'true' }))).toBe(true);
    oublierRepere();
    expect(lireRepere(stockage({ [PREMIERE_PIERRE_KEY]: 'nimporte' }))).toBe(false);
  });

  it('stockage indisponible : le repère vaut pour la session', () => {
    const casse = { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } };
    expect(lireRepere(casse)).toBe(false);
    oublierRepere();
    expect(() => noterPierrePosee(casse)).not.toThrow();
    expect(lireRepere(casse)).toBe(true);
  });

  it('prévient l’accueil (événement de fenêtre) à la première pierre seulement', () => {
    const cible = new EventTarget();
    vi.stubGlobal('window', cible);
    const rappel = vi.fn();
    const fin = abonnerPierre(rappel);
    const s = stockage();
    noterPierrePosee(s);
    noterPierrePosee(s);
    expect(rappel).toHaveBeenCalledTimes(1);
    fin();
    cible.dispatchEvent(new Event(EVENEMENT_PREMIERE_PIERRE));
    expect(rappel).toHaveBeenCalledTimes(1);
  });
});
