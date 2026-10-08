import { describe, expect, it } from 'vitest';
import { newPosition } from '../go/rules';
import { score } from '../go/score';
import { annonceKomi, equilibrage, KOMI_DEBUTANT, KOMI_NORMAL, PARTIES_KOMI_DEBUTANT, PARTIES_SANS_BARRE_AVANTAGE, partiesOrdi, rendrePartieOrdi } from './equilibrage';

const FINE = ' ';

describe('partie finie sur un plateau presque vide (#251)', () => {
  it('rend la partie à komi réduit consommée au lancement', () => {
    // Lancement de la première partie : ordi passe à 1. Deux passes précoces : on rend la partie.
    const apres = rendrePartieOrdi({ n: 1, ordi: 1, dernier: 'pomme' });
    expect(apres).toEqual({ n: 1, ordi: 0, dernier: 'pomme' });
    expect(equilibrage(partiesOrdi(apres)).komi).toBe(KOMI_DEBUTANT);
    // Dernière partie à komi réduit : elle est rendue, la suivante l'a encore.
    const derniere = rendrePartieOrdi({ n: 3, ordi: PARTIES_KOMI_DEBUTANT });
    expect(equilibrage(partiesOrdi(derniere)).komi).toBe(KOMI_DEBUTANT);
  });

  it('ne touche pas au compteur hors des parties à komi réduit', () => {
    const p = { n: 9, ordi: PARTIES_KOMI_DEBUTANT + 1 };
    expect(rendrePartieOrdi(p)).toBe(p);
    const vide = { n: 0 };
    expect(rendrePartieOrdi(vide)).toBe(vide);
  });
});

describe('équilibrage des premières parties contre l’ordi (#160)', () => {
  it('constantes : komi 0,5 pour 3 parties, barre cachée pendant 1 partie, komi habituel 6,5', () => {
    expect(KOMI_DEBUTANT).toBe(0.5);
    expect(KOMI_NORMAL).toBe(6.5);
    expect(PARTIES_KOMI_DEBUTANT).toBe(3);
    expect(PARTIES_SANS_BARRE_AVANTAGE).toBe(1);
    // La demie évite l'égalité : un plateau partagé à égalité reste gagné par Blanc, d'une demi-pierre.
    expect(KOMI_DEBUTANT % 1).toBe(0.5);
  });

  it('komi 0,5 pour les parties 1 à 3, puis 6,5', () => {
    expect([0, 1, 2, 3, 4, 50].map(r => equilibrage(r).komi)).toEqual([0.5, 0.5, 0.5, 6.5, 6.5, 6.5]);
  });

  it('barre d’avantage cachée pendant la toute première partie seulement', () => {
    expect([0, 1, 2, 3].map(r => equilibrage(r).avantage)).toEqual([false, true, true, true]);
  });

  it('l’ordi passe quand tu passes pendant les 3 premières parties (#185)', () => {
    expect([0, 1, 2, 3, 4].map(r => equilibrage(r).accommodant)).toEqual([true, true, true, false, false]);
  });

  it('compteur : champ `ordi`, sinon `n` pour les anciens compteurs, jamais négatif', () => {
    expect(partiesOrdi({ n: 0 })).toBe(0);
    expect(partiesOrdi({ n: 5, ordi: 1 })).toBe(1);
    expect(partiesOrdi({ n: 4 })).toBe(4);
    expect(partiesOrdi({ n: -2 })).toBe(0);
    expect(partiesOrdi({ n: Number.NaN })).toBe(0);
  });

  it('annonce : le komi est expliqué la première fois, puis rappelé, puis son retour à 6,5 est dit', () => {
    expect(annonceKomi(0, 0.5)).toBe(`Le komi\u202f: des points donnés à Blanc, qui joue en second. Pour tes premières parties, il est de 0,5.`);
    expect(annonceKomi(1, 0.5)).toBe('Cette partie encore, le komi est de 0,5 point.');
    expect(annonceKomi(2, 0.5)).toBe('Dernière partie avec un komi de 0,5 point.');
    expect(annonceKomi(3, 6.5)).toBe('Le komi passe à 6,5 points, sa valeur habituelle.');
    expect(annonceKomi(4, 6.5)).toBeNull();
    // Aucune phrase fausse : si le komi compté n'est pas celui de l'équilibrage (paramètre de test), on ne dit rien.
    expect(annonceKomi(0, -100)).toBeNull();
    expect(annonceKomi(3, 0.5)).toBeNull();
    for (let r = 0; r < 5; r++) expect(annonceKomi(r, equilibrage(r).komi) ?? '').not.toContain(FINE + FINE);
  });

  it('le komi annoncé est celui compté : plateau vide, Blanc gagne de 0,5 exactement', () => {
    const s = score(newPosition(9), equilibrage(0).komi, 'japanese');
    expect(s.winner).toBe(2);
    expect(s.margin).toBe(0.5);
    expect(s.white - s.black).toBe(KOMI_DEBUTANT);
  });
});
