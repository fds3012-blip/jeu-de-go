// La flamme dit l'état du jour ; Pomme accueille selon le jour (issue #213). Dates simulées en heure de Paris.
import { describe, expect, it } from 'vitest';
import { ABSENCE_MIN, estRetour, etatFlamme, lireVisite, repliqueDuJour, visiter } from './flamme';
import { accueil, type Jour } from './home';
import { numeroDuJour } from './goDuJour';

// Joueur qui revient : une partie finie contre Pomme, le bouton dit « Rejouer » (#309).
const pomme = { id: 'pomme', nom: 'Pomme', fini: true };
const joueur = { n: 3, dernier: 'pomme' };
const jour = (numero: number, j: Partial<Jour> = {}): Jour => ({ numero, absence: 0, duJourFait: false, titreDuJour: 'Double atari', ...j });
const phrases = (s: string) => s.split(/[.!?…](?:\s|$)/).filter(x => x.trim()).length;

describe('flamme de l’en-tête', () => {
  it('creuse tant que le Go du jour n’est pas fait, pleine après', () => {
    expect(etatFlamme(4, false)).toBe('creuse');
    expect(etatFlamme(5, true)).toBe('pleine');
  });
  it('pas de série, rien à allumer : pas de flamme éteinte mise en avant', () => {
    expect(etatFlamme(0, false)).toBeNull();
    expect(etatFlamme(1, true)).toBe('pleine');
  });
});

describe('visites et absence', () => {
  it('premier passage : pas un retour', () => {
    expect(visiter(null, 12)).toEqual({ jour: 12, absence: 0 });
  });
  it('mesure l’absence au premier passage du jour, et la garde toute la journée', () => {
    const v = visiter({ jour: 8, absence: 0 }, 12);
    expect(v).toEqual({ jour: 12, absence: 4 });
    expect(visiter(v, 12)).toBe(v);
    expect(visiter(v, 13)).toEqual({ jour: 13, absence: 1 });
  });
  it('retour à partir de 3 jours', () => {
    expect(ABSENCE_MIN).toBe(3);
    expect(estRetour(2)).toBe(false);
    expect(estRetour(3)).toBe(true);
  });
  it('tolère un stockage abîmé', () => {
    expect(lireVisite(null)).toBeNull();
    expect(lireVisite({ jour: 'x' })).toBeNull();
    expect(lireVisite({ jour: 5, absence: -2 })).toEqual({ jour: 5, absence: 0 });
  });
  it('jours comptés en heure de Paris, quel que soit le fuseau', () => {
    // 23 h 30 à Paris le 30/09 (n° 4), puis 0 h 30 le 01/10 (n° 5) : un jour de plus, pas un retour.
    const a = numeroDuJour(new Date('2026-09-30T23:30:00+02:00'));
    const b = numeroDuJour(new Date('2026-10-01T00:30:00+02:00'));
    expect([a, b]).toEqual([4, 5]);
    expect(visiter({ jour: a, absence: 0 }, b).absence).toBe(1);
  });
});

describe('bulle de Pomme selon le jour', () => {
  it('déterministe : même jour, même réplique', () => {
    expect(repliqueDuJour(['a', 'b', 'c'], 7)).toBe(repliqueDuJour(['a', 'b', 'c'], 7));
    expect(repliqueDuJour(['a', 'b', 'c'], -1)).toBe('c');
    expect(accueil(joueur, 1, pomme, 9, jour(20)).bulle).toBe(accueil(joueur, 1, pomme, 9, jour(20)).bulle);
  });

  it('varie d’un jour à l’autre (plusieurs répliques sur une semaine)', () => {
    const semaine = new Set(Array.from({ length: 7 }, (_, i) => accueil(joueur, 1, pomme, 9, jour(10 + i)).bulle));
    expect(semaine.size).toBeGreaterThanOrEqual(3);
  });

  it('ne propose pas le Go du jour à faire (le bouton dit « Rejouer », #236 N4), puis le félicite une fois fait', () => {
    const tous = Array.from({ length: 8 }, (_, i) => accueil(joueur, 1, pomme, 9, jour(i)).bulle);
    expect(tous.some(b => /Go du jour/.test(b))).toBe(false);
    const faits = Array.from({ length: 8 }, (_, i) => accueil(joueur, 1, pomme, 9, jour(i, { duJourFait: true })).bulle);
    expect(faits.some(b => /Bravo pour le Go du jour/.test(b))).toBe(true);
    expect(faits.some(b => /Nouveau Go du jour/.test(b))).toBe(false);
  });

  it('après une absence : un accueil chaleureux, jamais « Te revoilà ! On rejoue » de la veille, jamais de reproche', () => {
    const retours = Array.from({ length: 6 }, (_, i) => accueil(joueur, 1, pomme, 9, jour(30 + i, { absence: 4 })).bulle);
    expect(new Set(retours).size).toBe(3);
    for (const b of retours) {
      expect(b).not.toMatch(/On rejoue/);
      expect(b).not.toMatch(/triste|oubli|enfin|dommage/i);
    }
  });

  it('deux phrases au plus, et jamais une seconde action sur le plateau', () => {
    for (let n = 0; n < 12; n++) for (const j of [jour(n), jour(n, { duJourFait: true }), jour(n, { absence: 5 })]) {
      for (const dernier of ['pomme', 'caillou']) {
        const b = accueil({ n: 2, dernier }, 1, pomme, 9, j).bulle;
        expect(phrases(b)).toBeLessThanOrEqual(2);
        expect(b).not.toMatch(/touche/i);
      }
    }
  });

  it('nouveau joueur : la bulle de la première partie, même un jour de retour', () => {
    expect(accueil({ n: 0 }, 0, pomme, 9, jour(3, { absence: 5 })).bulle).toMatch(/^Apprends le go en jouant/);
  });
});
