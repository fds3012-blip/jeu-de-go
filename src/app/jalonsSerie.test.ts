import { describe, expect, it } from 'vitest';
import { avancementDuJour, estJalon, jalonFranchi } from './jalonsSerie';

describe('jalons de série (#214)', () => {
  it('3, 7 et 30 sont des jalons ; 1, 2, 4, 14, 31 non', () => {
    for (const j of [3, 7, 30]) expect(estJalon(j)).toBe(true);
    for (const j of [0, 1, 2, 4, 14, 31]) expect(estJalon(j)).toBe(false);
  });

  it('le Go du jour qui fait passer la série à 3 franchit le jalon', () => {
    expect(jalonFranchi({ dernier: 4, jours: 2 }, { dernier: 5, jours: 3 }, 5)).toBe(3);
    expect(jalonFranchi({ dernier: 9, jours: 6 }, { dernier: 10, jours: 7 }, 10)).toBe(7);
    expect(jalonFranchi({ dernier: 39, jours: 29 }, { dernier: 40, jours: 30 }, 40)).toBe(30);
  });

  it('hors jalon, rien', () => {
    expect(jalonFranchi({ dernier: 4, jours: 3 }, { dernier: 5, jours: 4 }, 5)).toBeNull();
    expect(jalonFranchi(null, { dernier: 5, jours: 1 }, 5)).toBeNull();
  });

  it('série déjà allumée aujourd’hui par une leçon : pas de seconde fête', () => {
    expect(jalonFranchi({ dernier: 5, jours: 3 }, { dernier: 5, jours: 3 }, 5)).toBeNull();
  });

  it('série absente ou d’un autre jour : rien', () => {
    expect(jalonFranchi(null, null, 5)).toBeNull();
    expect(jalonFranchi({ dernier: 3, jours: 2 }, { dernier: 4, jours: 3 }, 5)).toBeNull();
  });
});

describe('fin de leçon ou de partie qui allume la série (#U4)', () => {
  it('première action du jour : les jours de série, et le jalon s’il y en a un', () => {
    expect(avancementDuJour({ dernier: 4, jours: 1 }, { dernier: 5, jours: 2 }, 5)).toEqual({ jours: 2, jalon: null });
    expect(avancementDuJour(null, { dernier: 5, jours: 1 }, 5)).toEqual({ jours: 1, jalon: null });
    expect(avancementDuJour({ dernier: 4, jours: 2 }, { dernier: 5, jours: 3 }, 5)).toEqual({ jours: 3, jalon: 3 });
    expect(avancementDuJour({ dernier: 9, jours: 6 }, { dernier: 10, jours: 7 }, 10)).toEqual({ jours: 7, jalon: 7 });
  });

  it('série déjà allumée aujourd’hui : rien, la ligne ne se répète pas', () => {
    expect(avancementDuJour({ dernier: 5, jours: 2 }, { dernier: 5, jours: 2 }, 5)).toBeNull();
  });

  it('action qui ne compte pas (série inchangée, ou d’un autre jour) : rien', () => {
    expect(avancementDuJour({ dernier: 3, jours: 2 }, { dernier: 3, jours: 2 }, 5)).toBeNull();
    expect(avancementDuJour(null, null, 5)).toBeNull();
  });
});
