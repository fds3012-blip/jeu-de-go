// La flamme dit l'état du jour ; Pomme accueille selon le jour (issue #213). Dates simulées en heure de Paris.
import { afterEach, describe, expect, it } from 'vitest';
import { choisirLangue } from '../content/i18n';
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

describe('bulle de l’adversaire selon le jour (#213, #695)', () => {
  it('déterministe : même jour, même réplique', () => {
    expect(repliqueDuJour(['a', 'b', 'c'], 7)).toBe(repliqueDuJour(['a', 'b', 'c'], 7));
    expect(repliqueDuJour(['a', 'b', 'c'], -1)).toBe('c');
    expect(accueil(joueur, 1, pomme, 9, jour(20)).bulle).toBe(accueil(joueur, 1, pomme, 9, jour(20)).bulle);
  });

  it('#695 : la série en jeu, dite en une phrase qui compte le jour suivant', () => {
    expect(accueil(joueur, 1, pomme, 9, jour(5, { serie: 6 })).bulle).toBe('Série de 6 jours. Un Go du jour et c’est 7.');
    expect(accueil(joueur, 1, pomme, 9, jour(5, { serie: 1 })).bulle).toBe('Série de 1 jour. Un Go du jour et c’est 2.');
  });

  it('#695 : sans série, un nouveau Go du jour ; fait, « À demain ! » (série ou non)', () => {
    expect(accueil(joueur, 1, pomme, 9, jour(5)).bulle).toBe('Nouveau Go du jour.');
    expect(accueil(joueur, 1, pomme, 9, jour(5, { serie: 0 })).bulle).toBe('Nouveau Go du jour.');
    expect(accueil(joueur, 1, pomme, 9, jour(5, { duJourFait: true })).bulle).toMatch(/^Fait pour aujourd’hui\. À demain\s!$/);
    expect(accueil(joueur, 1, pomme, 9, jour(5, { duJourFait: true, serie: 7 })).bulle).toMatch(/^Fait pour aujourd’hui\. À demain/);
  });

  it('#695 : la phrase d’état ne dépend ni de l’adversaire ni du « Rejouer » (quel que soit le mode du bouton)', () => {
    const j = jour(9, { serie: 3 });
    const a = accueil({ n: 3, dernier: 'pomme' }, 1, pomme, 9, j).bulle;
    expect(accueil({ n: 3, dernier: 'pomme' }, 1, { id: 'caillou', nom: 'Caillou' }, 13, j).bulle).toBe(a);
    expect(accueil({ n: 3, dernier: 'caillou' }, 1, { ...pomme, fini: false }, 9, j).bulle).toBe(a);
  });

  it('#695 : sans Go du jour connu, la bulle invite à la partie comme le bouton', () => {
    expect(accueil(joueur, 1, pomme, 9, jour(5, { titreDuJour: undefined })).bulle).toMatch(/On rejoue/);
  });

  it('#695 : jamais de culpabilité ni de compte à rebours', () => {
    for (let n = 0; n < 12; n++) for (const j of [jour(n), jour(n, { serie: n }), jour(n, { duJourFait: true, serie: n }), jour(n, { absence: 4 })]) {
      const b = accueil(joueur, 1, pomme, 9, j).bulle;
      expect(b).not.toMatch(/perd|perdre|risque|dernier|vite|heures?\b|minutes?\b|avant minuit|plus que|reste|oubli|triste|dommage|enfin/i);
      expect(b).not.toMatch(/\d+\s*(h|min)\b/);
    }
  });

  it('après une absence : un accueil chaleureux, jamais « Te revoilà ! On rejoue » de la veille, jamais de reproche', () => {
    const retours = Array.from({ length: 6 }, (_, i) => accueil(joueur, 1, pomme, 9, jour(30 + i, { absence: 4, serie: 5 })).bulle);
    expect(new Set(retours).size).toBe(3);
    for (const b of retours) {
      expect(b).not.toMatch(/On rejoue/);
      expect(b).not.toMatch(/triste|oubli|enfin|dommage/i);
    }
  });

  it('deux phrases au plus, et jamais une seconde action sur le plateau', () => {
    for (let n = 0; n < 12; n++) for (const j of [jour(n), jour(n, { serie: n }), jour(n, { duJourFait: true }), jour(n, { absence: 5 })]) {
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

describe('bulle de l’adversaire en anglais (#695 : parité avec le français)', () => {
  afterEach(() => choisirLangue('fr'));
  it('mêmes cas, mêmes phrases courtes', () => {
    choisirLangue('en');
    const ligne = (j: Partial<Jour>) => accueil(joueur, 1, pomme, 9, jour(5, j)).bulle;
    expect(ligne({ serie: 6 })).toBe('6-day streak. One Daily Go and it’s 7.');
    expect(ligne({ serie: 1 })).toBe('1-day streak. One Daily Go and it’s 2.');
    expect(ligne({})).toBe('New Daily Go.');
    expect(ligne({ duJourFait: true })).toBe('Done for today. See you tomorrow!');
    for (const j of [{}, { serie: 3 }, { duJourFait: true }]) expect(phrases(ligne(j))).toBeLessThanOrEqual(2);
  });
});
