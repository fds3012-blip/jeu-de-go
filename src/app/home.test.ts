import { describe, expect, it } from 'vitest';
import { accueil, introBut } from './home';

const pomme = { id: 'pomme', nom: 'Pomme' };
const caillou = { id: 'caillou', nom: 'Caillou' };

describe('accueil', () => {
  it('nouveau joueur : Mochi et le bouton proposent la première partie contre Pomme', () => {
    const a = accueil({ n: 0 }, 0, pomme, 9);
    expect(a.nouveau).toBe(true);
    expect(a.cta).toBe('Joue ta première partie contre Pomme');
    expect(a.mochi).toContain('première pierre contre Pomme');
  });

  it('leçons faites, aucune partie : toujours la première partie', () => {
    const a = accueil({ n: 0 }, 2, pomme, 9);
    expect(a.nouveau).toBe(false);
    expect(a.cta).toBe('Joue ta première partie contre Pomme');
    expect(a.mochi).toContain('tes 2 leçons');
  });

  it('joueur qui revient contre le même adversaire : Rejouer', () => {
    const a = accueil({ n: 3, dernier: 'pomme' }, 0, pomme, 13);
    expect(a.cta).toBe('Rejouer contre Pomme');
    expect(a.mochi).toContain('Pomme');
    expect(a.mochi).toContain('13 × 13');
  });

  it('joueur qui revient avec un autre adversaire : Jouer contre lui', () => {
    const a = accueil({ n: 3, dernier: 'pomme' }, 1, caillou, 9);
    expect(a.cta).toBe('Jouer contre Caillou');
    expect(a.mochi).toContain('Caillou');
  });

  it('Mochi parle en deux phrases au plus', () => {
    for (const a of [accueil({ n: 0 }, 0, pomme, 9), accueil({ n: 0 }, 1, pomme, 9), accueil({ n: 1, dernier: 'pomme' }, 0, pomme, 9)]) {
      expect(a.mochi.split(/[.!?](\s|$)/).filter(s => s && s.trim()).length).toBeLessThanOrEqual(2);
    }
    const but = introBut('Pomme');
    expect(but).toMatch(/territoire que Pomme/);
    expect(but).toMatch(/libertés/);
    expect(but.split(/[.!?](\s|$)/).filter(s => s && s.trim()).length).toBe(1);
  });
});
