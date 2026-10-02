import { describe, expect, it } from 'vitest';
import { ordreDuJour, type ContexteDuJour } from './aujourdhui';

const ctx = (c: Partial<ContexteDuJour> = {}): ContexteDuJour => ({ premier: false, defis: 0, goDuJour: 'aFaire', lecon: true, ...c });
const genres = (c: Partial<ContexteDuJour>) => ordreDuJour(ctx(c)).map(t => t.genre);
const enAvant = (c: Partial<ContexteDuJour>) => ordreDuJour(ctx(c)).filter(t => t.enAvant).map(t => t.genre);

describe('ordre du jour sur l’accueil', () => {
  it('premier lancement : Go du jour puis leçon, rien en avant (la première partie suffit)', () => {
    expect(genres({ premier: true, goDuJour: 'neutre' })).toEqual(['goDuJour', 'lecon']);
    expect(enAvant({ premier: true, goDuJour: 'neutre' })).toEqual([]);
    expect(enAvant({ premier: true, goDuJour: 'aFaire', defis: 2 })).toEqual([]);
  });

  it('Go du jour à faire : en premier et en avant, la leçon suit', () => {
    expect(genres({})).toEqual(['goDuJour', 'lecon']);
    expect(enAvant({})).toEqual(['goDuJour']);
  });

  it('Go du jour fait : la leçon passe devant, le Go du jour reste (constat)', () => {
    expect(genres({ goDuJour: 'fait' })).toEqual(['lecon', 'goDuJour']);
    expect(enAvant({ goDuJour: 'fait' })).toEqual(['lecon']);
  });

  it('un défi où c’est ton tour passe avant tout', () => {
    expect(genres({ defis: 1 })).toEqual(['defi', 'goDuJour', 'lecon']);
    expect(enAvant({ defis: 1 })).toEqual(['defi']);
  });

  it('toutes les leçons faites : le Go du jour seul', () => {
    expect(genres({ lecon: false })).toEqual(['goDuJour']);
    expect(genres({ lecon: false, goDuJour: 'fait' })).toEqual(['goDuJour']);
    expect(enAvant({ lecon: false, goDuJour: 'fait' })).toEqual([]);
  });

  it('sans Go du jour (hors ligne, contenu absent) : la leçon seule', () => {
    expect(genres({ goDuJour: null })).toEqual(['lecon']);
    expect(enAvant({ goDuJour: null })).toEqual(['lecon']);
  });

  it('jamais deux tuiles en avant', () => {
    for (const c of [{}, { defis: 3 }, { goDuJour: 'fait' as const }, { goDuJour: null }, { lecon: false }]) {
      expect(enAvant(c).length).toBeLessThanOrEqual(1);
    }
  });
});
