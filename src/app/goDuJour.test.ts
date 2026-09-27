import { describe, expect, it } from 'vitest';
import { BASE_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { toLabel } from '../go/coords';
import { dateParis, numeroDuJour, numeroDuLien, problemeDuNumero, serieApres, serieVivante, textePartage } from './goDuJour';

const liste = parsePuzzles(BASE_PUZZLES);

describe('numéro du Go du jour', () => {
  it('vaut 1 le jour du lancement, puis +1 par jour', () => {
    expect(numeroDuJour(new Date('2026-09-27T10:00:00+02:00'))).toBe(1);
    expect(numeroDuJour(new Date('2026-09-28T10:00:00+02:00'))).toBe(2);
    expect(numeroDuJour(new Date('2026-10-27T10:00:00+01:00'))).toBe(31); // passage à l'heure d'hiver
  });

  it('change à minuit à Paris, pas à minuit UTC ni à minuit de l’appareil', () => {
    // 23 h 59 à Paris le 27 = 21 h 59 UTC ; minuit à Paris le 28 = 22 h 00 UTC le 27.
    expect(numeroDuJour(new Date('2026-09-27T21:59:00Z'))).toBe(1);
    expect(numeroDuJour(new Date('2026-09-27T22:00:00Z'))).toBe(2);
    expect(dateParis(new Date('2026-09-27T22:00:00Z'))).toBe('2026-09-28');
  });

  it('ne dépend pas du fuseau de l’appareil (le calcul passe par Intl et Europe/Paris)', () => {
    // Le même instant vu depuis New York (18 h le 27) ou Tokyo (7 h le 28) : un seul numéro, celui de Paris.
    const instant = new Date('2026-09-27T22:30:00Z');
    const ny = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', day: '2-digit' }).format(instant);
    const tokyo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', day: '2-digit' }).format(instant);
    expect([ny, tokyo]).toEqual(['27', '28']);
    expect(numeroDuJour(instant)).toBe(2);
  });

  it('lit le numéro d’un lien partagé', () => {
    expect(numeroDuLien('?go-du-jour=12')).toBe(12);
    expect(numeroDuLien('?x=1&go-du-jour=1')).toBe(1);
    expect(numeroDuLien('?go-du-jour=abc')).toBeNull();
    expect(numeroDuLien('?go-du-jour=-3')).toBeNull();
    expect(numeroDuLien('')).toBeNull();
  });
});

describe('problème du Go du jour', () => {
  it('est déterministe : même numéro, même problème, quel que soit l’ordre de la liste', () => {
    const melangee = [...liste].reverse();
    for (let n = 1; n <= 20; n++) expect(problemeDuNumero(melangee, n)?.id).toBe(problemeDuNumero(liste, n)?.id);
    expect(problemeDuNumero(liste, 1)?.id).toBe('b1');
    expect(problemeDuNumero(liste, 2)?.id).toBe('b2');
    expect(problemeDuNumero(liste, 7)?.id).toBe('b1');
  });

  it('même jour à Paris, même problème ; le lendemain, un autre', () => {
    const matin = problemeDuNumero(liste, numeroDuJour(new Date('2026-09-27T06:00:00+02:00')));
    const soir = problemeDuNumero(liste, numeroDuJour(new Date('2026-09-27T23:30:00+02:00')));
    const demain = problemeDuNumero(liste, numeroDuJour(new Date('2026-09-28T00:01:00+02:00')));
    expect(soir).toBe(matin);
    expect(demain).not.toBe(matin);
  });

  it('liste vide : pas de problème', () => {
    expect(problemeDuNumero([], 1)).toBeUndefined();
  });
});

describe('série et texte de partage', () => {
  it('la série monte si la veille est réussie, sinon repart à 1', () => {
    expect(serieApres(null, 5)).toEqual({ dernier: 5, jours: 1 });
    expect(serieApres({ dernier: 4, jours: 2 }, 5)).toEqual({ dernier: 5, jours: 3 });
    expect(serieApres({ dernier: 5, jours: 3 }, 5)).toEqual({ dernier: 5, jours: 3 });
    expect(serieApres({ dernier: 2, jours: 9 }, 5)).toEqual({ dernier: 5, jours: 1 });
    expect(serieVivante({ dernier: 4, jours: 2 }, 5)).toBe(2);
    expect(serieVivante({ dernier: 3, jours: 2 }, 5)).toBe(0);
    expect(serieVivante(null, 5)).toBe(0);
  });

  it('suit le format attendu, avec le lien', () => {
    const p = textePartage(1, 1, 3);
    expect(p.texte).toBe('Go du jour n° 1 · résolu en 1 essai · série 3 🔥');
    expect(p.url).toBe('https://jeu-de-go.vercel.app/?go-du-jour=1');
    expect(p.complet).toBe(`${p.texte}\n${p.url}`);
    expect(textePartage(42, 2, 7).texte).toBe('Go du jour n° 42 · résolu en 2 essais · série 7 🔥');
  });

  it('ne révèle jamais la coordonnée de la réponse', () => {
    for (let n = 1; n <= liste.length; n++) {
      const pz = problemeDuNumero(liste, n)!;
      const { complet } = textePartage(n, 2, 4);
      for (const r of pz.answers) {
        const label = toLabel(r, pz.size);
        expect(complet).not.toMatch(new RegExp(`\\b${label}\\b`, 'i'));
      }
      expect(complet).not.toMatch(/\b[A-HJ-T](1[0-9]|[1-9])\b/);
    }
  });
});
