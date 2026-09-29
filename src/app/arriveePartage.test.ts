import { describe, expect, it } from 'vitest';
import { jamaisJoue, numeroOuvert, proprietesArrivee, sansActivite } from './arriveePartage';

describe('arrivée par un lien partagé (#285)', () => {
  it('un appareil vierge n’a jamais joué', () => {
    expect(jamaisJoue([null, undefined, {}, { n: 0 }, { l1: 0 }])).toBe(true);
  });

  it('la moindre trace de jeu compte', () => {
    expect(jamaisJoue([{ n: 1 }])).toBe(false); // une partie
    expect(jamaisJoue([{ l1: 2 }])).toBe(false); // deux étapes de leçon
    expect(jamaisJoue([{ b1: true }])).toBe(false); // un problème réussi
    expect(jamaisJoue([{ dernier: 3, jours: 1 }])).toBe(false); // série du Go du jour
    expect(jamaisJoue([{ fait: false, saute: true, date: '2026-09-29' }])).toBe(false); // placement passé
  });

  it('une valeur illisible n’est pas prise pour un appareil vierge', () => {
    expect(sansActivite('x')).toBe(false);
    expect(sansActivite([])).toBe(false);
  });

  it('numéro ouvert : un numéro passé ouvre ce jour-là, un numéro à venir ou 0 ouvre celui du jour', () => {
    expect(numeroOuvert(3, 5)).toBe(3);
    expect(numeroOuvert(5, 5)).toBe(5);
    expect(numeroOuvert(9, 5)).toBe(5);
    expect(numeroOuvert(0, 5)).toBe(5);
  });

  it('arrivee_par_partage porte numero, lang et nouveau_joueur', () => {
    expect(proprietesArrivee(3, 5, 'en', true)).toEqual({ numero: 3, numero_demande: 3, numero_du_jour: 5, lang: 'en', nouveau_joueur: true });
  });
});
