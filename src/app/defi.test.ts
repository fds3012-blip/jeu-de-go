import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SERIE_UN_DEFI, compteDansSerie, faitApres, goDuJourFait, lireFait } from './defi';
import { SERIE_KEY, numeroDuJour, type Serie } from './goDuJour';
import { GEL_KEY } from './gel';

// Dates simulées, à midi heure de Paris (27/09/2026 = Go du jour n° 1).
// Environnement Node : un localStorage en mémoire suffit.
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, clear: () => memoire.clear() });

const midi = (iso: string) => new Date(`${iso}T12:00:00+02:00`);
const jour = (iso: string) => numeroDuJour(midi(iso));

describe('un défi par jour (#199), logique pure', () => {
  it('hypothèse active par défaut', () => {
    expect(SERIE_UN_DEFI).toBe(true);
  });

  it('le Go du jour compte toujours ; leçon et révision seulement avec SERIE_UN_DEFI', () => {
    expect(compteDansSerie('go_du_jour', false)).toBe(true);
    expect(compteDansSerie('lecon', false)).toBe(false);
    expect(compteDansSerie('revision', false)).toBe(false);
    expect(compteDansSerie('lecon', true)).toBe(true);
    expect(compteDansSerie('revision', true)).toBe(true);
  });

  it('Go du jour fait : repère à part, sinon ancienne règle', () => {
    const n = jour('2026-10-02');
    expect(goDuJourFait({ dernier: n, jours: 2 }, null, n)).toBe(true); // appareil d’avant #199
    expect(goDuJourFait({ dernier: n, jours: 2 }, n - 1, n)).toBe(false); // la série vient d’une leçon
    expect(goDuJourFait(null, n, n)).toBe(true);
    expect(goDuJourFait(null, null, n)).toBe(false);
  });

  it('le repère avance avec le Go du jour, se fige avec un autre défi', () => {
    const n = jour('2026-10-02');
    expect(faitApres(null, null, 'go_du_jour', n)).toBe(n);
    expect(faitApres(null, { dernier: n - 1, jours: 3 }, 'lecon', n)).toBe(n - 1);
    expect(faitApres(n - 4, { dernier: n - 1, jours: 3 }, 'revision', n)).toBe(n - 4);
    expect(faitApres(null, null, 'lecon', n)).toBe(0);
    expect(lireFait(4)).toBe(4);
    expect(lireFait('4')).toBeNull();
  });
});

describe('un défi par jour, sur l’appareil', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('leçon lundi, révision mardi, Go du jour mercredi : 3 jours de suite', async () => {
    const { validerDefi, goDuJourFaitAppareil } = await import('./defiAppareil');
    validerDefi('lecon', midi('2026-10-05'));
    expect(JSON.parse(localStorage.getItem(SERIE_KEY)!)).toEqual({ dernier: jour('2026-10-05'), jours: 1 });
    expect(goDuJourFaitAppareil(jour('2026-10-05'))).toBe(false); // la leçon ne coche pas le Go du jour
    validerDefi('revision', midi('2026-10-06'));
    const r = validerDefi('go_du_jour', midi('2026-10-07'));
    expect(r.serie).toEqual({ dernier: jour('2026-10-07'), jours: 3 });
    expect(goDuJourFaitAppareil(jour('2026-10-07'))).toBe(true);
  });

  it('deux défis le même jour : la série n’avance qu’une fois', async () => {
    const { validerDefi, goDuJourFaitAppareil } = await import('./defiAppareil');
    validerDefi('lecon', midi('2026-10-05'));
    const r = validerDefi('go_du_jour', midi('2026-10-05'));
    expect(r.serie).toEqual({ dernier: jour('2026-10-05'), jours: 1 });
    expect(goDuJourFaitAppareil(jour('2026-10-05'))).toBe(true);
  });

  it('un gel gagné au 7e jour, quel que soit le défi', async () => {
    const { validerDefi } = await import('./defiAppareil');
    localStorage.setItem(SERIE_KEY, JSON.stringify({ dernier: jour('2026-10-04'), jours: 6 } satisfies Serie));
    const r = validerDefi('lecon', midi('2026-10-05'));
    expect(r.gagne).toBe(true);
    expect(JSON.parse(localStorage.getItem(GEL_KEY)!).gels).toBe(1);
  });

  it('appareil d’avant #199 : le Go du jour réussi aujourd’hui reste coché après une leçon', async () => {
    const { validerDefi, goDuJourFaitAppareil } = await import('./defiAppareil');
    const n = jour('2026-10-05');
    localStorage.setItem(SERIE_KEY, JSON.stringify({ dernier: n, jours: 2 }));
    validerDefi('lecon', midi('2026-10-05'));
    expect(goDuJourFaitAppareil(n)).toBe(true);
    // Le lendemain, une leçon fait vivre la série sans cocher le Go du jour.
    validerDefi('lecon', midi('2026-10-06'));
    expect(goDuJourFaitAppareil(n + 1)).toBe(false);
    expect(JSON.parse(localStorage.getItem(SERIE_KEY)!)).toEqual({ dernier: n + 1, jours: 3 });
  });
});
