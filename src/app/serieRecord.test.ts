// Rien de gagné ne se perd (issue #212) : record de série, série perdue constatée une fois, badge jamais retiré.
// Dates simulées : l'horloge est figée en heure de Paris, les jours sont les numéros du Go du jour.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, clear: () => memoire.clear() });
vi.mock('../data/analytics', async orig => ({ ...(await orig<typeof import('../data/analytics')>()), track: (...a: unknown[]) => track(...a) }));

const { RECORD_VIDE, avecRecord, annoncerPerte, constaterPerte, lireRecord, messagePerte, RECORD_KEY } = await import('./serieRecord');
const { constaterPerteAppareil, lireRecordAppareil, noterRecordAppareil, reconcilierAppareil, reussirAppareil } = await import('./gelAppareil');
const { SERIE_KEY, numeroDuJour } = await import('./goDuJour');
const { GEL_KEY } = await import('./gel');
const { badges, lireBadges, memoriser, statistiques } = await import('./vitrine');
const { EVENTS } = await import('../data/analytics');

const lire = (k: string) => JSON.parse(localStorage.getItem(k) ?? 'null');
/** Midi, heure de Paris, le jour du Go du jour n° `n` (n° 1 = 27/09/2026). */
const midi = (n: number) => new Date(Date.UTC(2026, 8, 27 + n - 1, 10));

describe('record de série (logique pure)', () => {
  it('ne descend jamais', () => {
    const e = avecRecord(RECORD_VIDE, 7);
    expect(e.record).toBe(7);
    expect(avecRecord(e, 3)).toBe(e);
    expect(avecRecord(e, 9).record).toBe(9);
  });

  it('tolère un stockage abîmé', () => {
    expect(lireRecord(null)).toEqual(RECORD_VIDE);
    expect(lireRecord({ record: -3, perdue: 'x' })).toEqual(RECORD_VIDE);
    expect(lireRecord({ record: 4.5 })).toEqual(RECORD_VIDE);
    expect(lireRecord({ record: 12, perdue: 8 })).toEqual({ record: 12, perdue: 8 });
  });

  it('série vivante (réussie hier ou aujourd’hui) : pas de perte, mais le record la suit', () => {
    expect(constaterPerte({ dernier: 9, jours: 5 }, RECORD_VIDE, 10)).toEqual({ etat: { record: 5, perdue: null }, perte: null });
    expect(constaterPerte({ dernier: 10, jours: 5 }, RECORD_VIDE, 10).perte).toBeNull();
    expect(constaterPerte(null, RECORD_VIDE, 10).perte).toBeNull();
  });

  it('dernier Go du jour réussi avant-hier : série perdue, une seule fois', () => {
    const r = constaterPerte({ dernier: 7, jours: 7 }, RECORD_VIDE, 11);
    expect(r.perte).toEqual({ jours: 7, record: 7, manques: 3 });
    expect(r.etat).toEqual({ record: 7, perdue: 7 });
    expect(constaterPerte({ dernier: 7, jours: 7 }, r.etat, 12).perte).toBeNull();
  });

  it('Mochi ne parle qu’à partir de 2 jours perdus', () => {
    expect(annoncerPerte({ jours: 1, record: 1, manques: 2 })).toBe(false);
    expect(annoncerPerte({ jours: 2, record: 2, manques: 2 })).toBe(true);
    expect(annoncerPerte(null)).toBe(false);
  });

  it('message sans reproche, jamais « 0 »', () => {
    const nouveau = messagePerte({ jours: 7, record: 7, manques: 3 });
    expect(nouveau).toContain('Ta série de 7 jours est dans ton record');
    const ancien = messagePerte({ jours: 3, record: 12, manques: 3 });
    expect(ancien).toContain('Ton record reste 12 jours');
    for (const m of [nouveau, ancien]) {
      expect(m).not.toMatch(/\b0\b|dommage|triste|perdu|raté/i);
    }
  });
});

describe('sur l’appareil, avec des dates simulées', () => {
  beforeEach(() => { localStorage.clear(); track.mockClear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('7 jours de suite, puis 3 jours d’absence sans gel : record 7, événement une fois', () => {
    let serie = null;
    for (let n = 1; n <= 6; n++) {
      vi.setSystemTime(midi(n));
      serie = reussirAppareil(serie, numeroDuJour(new Date())).serie;
    }
    expect(lireRecordAppareil().record).toBe(6);
    localStorage.setItem(GEL_KEY, JSON.stringify({ gels: 0, geles: [], annonce: null })); // pas de gel
    localStorage.setItem(SERIE_KEY, JSON.stringify({ dernier: 7, jours: 7 }));

    vi.setSystemTime(midi(11)); // jours 8, 9, 10 manqués
    expect(reconcilierAppareil(new Date())).toBeNull();
    const perte = constaterPerteAppareil(new Date());
    expect(perte).toEqual({ jours: 7, record: 7, manques: 3 });
    expect(lire(RECORD_KEY)).toEqual({ record: 7, perdue: 7 });
    expect(track).toHaveBeenCalledWith(EVENTS.seriePerdue, { jours: 7, record: 7, jours_manques: 3, gels: 0 });

    // Rechargement le même jour, ou le lendemain : pas de deuxième annonce, pas de deuxième événement.
    expect(constaterPerteAppareil(new Date())).toBeNull();
    vi.setSystemTime(midi(12));
    expect(constaterPerteAppareil(new Date())).toBeNull();
    expect(track.mock.calls.filter(c => c[0] === EVENTS.seriePerdue)).toHaveLength(1);

    // Nouvelle série : le record reste 7.
    const s = reussirAppareil(lire(SERIE_KEY), 12).serie;
    expect(s).toEqual({ dernier: 12, jours: 1 });
    expect(lireRecordAppareil().record).toBe(7);
  });

  it('un gel sauve la série : pas de perte', () => {
    localStorage.setItem(SERIE_KEY, JSON.stringify({ dernier: 7, jours: 7 }));
    localStorage.setItem(GEL_KEY, JSON.stringify({ gels: 1, geles: [], annonce: null }));
    vi.setSystemTime(midi(9)); // jour 8 manqué, couvert
    expect(reconcilierAppareil(new Date())).toBe(7);
    expect(constaterPerteAppareil(new Date())).toBeNull();
    expect(track.mock.calls.some(c => c[0] === EVENTS.seriePerdue)).toBe(false);
  });

  it('la série du serveur compte dans le record (le max des deux)', () => {
    noterRecordAppareil(4);
    expect(noterRecordAppareil(9)).toBe(9);
    expect(noterRecordAppareil(2)).toBe(9);
    expect(lire(RECORD_KEY)).toEqual({ record: 9, perdue: null });
  });
});

describe('vitrine : un badge gagné n’est jamais retiré', () => {
  const base = { reussis: 0, parties: 0, bilan: {}, paliers: [] };

  it('« 7 jours de série » tient avec le record, même quand la série est à 0', () => {
    expect(badges({ ...base, serie: 0, record: 7 }).find(b => b.id === 'serie-7')?.obtenu).toBe(true);
    expect(badges({ ...base, serie: 0, record: 6 }).find(b => b.id === 'serie-7')?.obtenu).toBe(false);
  });

  it('les badges mémorisés restent obtenus, même sans données', () => {
    const gagnes = memoriser([], badges({ ...base, serie: 7 }));
    expect(gagnes).toEqual(['serie-7']);
    expect(badges({ ...base, serie: 0 }, gagnes).find(b => b.id === 'serie-7')?.obtenu).toBe(true);
    // Rien de neuf : même liste, pas d'écriture.
    expect(memoriser(gagnes, badges({ ...base, serie: 0 }, gagnes))).toBe(gagnes);
    expect(lireBadges('abîmé')).toEqual([]);
    expect(lireBadges(['serie-7', 3])).toEqual(['serie-7']);
  });

  it('Profil : le record à la place de « 0 jour de série », jamais plus petit que la série en cours (#214)', () => {
    const p = { lecons: { faites: 0, total: 7 }, adversaires: 9 };
    const s = statistiques({ ...base, serie: 0, record: 7 }, p).find(x => x.id === 'record');
    expect(s).toMatchObject({ valeur: 7, legende: 'jours, ta série record' });
    expect(statistiques({ ...base, serie: 2, record: 7 }, p).find(x => x.id === 'record')).toMatchObject({ valeur: 7 });
    expect(statistiques({ ...base, serie: 9, record: 7 }, p).find(x => x.id === 'record')).toMatchObject({ valeur: 9 });
  });
});
