// Issue #236 (N2) : une fête à la fois, jamais sur la consigne.
import { describe, expect, it } from 'vitest';
import { ajouter, avancer, exercice, FILE_VIDE, marquerVue, retirer, terminer, type EtatFile, type Fete } from './fileFetes';

const xp = (points: number, bonus = 0): Fete => ({ genre: 'xp', points, bonus });
const niveau = (n: number): Fete => ({ genre: 'niveau', niveau: n });
const installation: Fete = { genre: 'installation' };
const pousser = (e: EtatFile, f: Fete) => avancer(ajouter(e, f));

describe('file des célébrations', () => {
  it('une seule à la fois : la suivante attend la fin de la première', () => {
    let e = pousser(FILE_VIDE, xp(20));
    e = pousser(e, niveau(2));
    expect(e.actif).toEqual(xp(20));
    expect(e.attente).toEqual([niveau(2)]);
    e = avancer(terminer(e));
    expect(e.actif).toEqual(niveau(2));
    expect(avancer(terminer(e)).actif).toBeNull();
  });

  it("ordre : l'XP, puis le niveau, puis l'installation, quel que soit l'ordre d'arrivée", () => {
    let e = ajouter(FILE_VIDE, installation);
    e = ajouter(e, niveau(3));
    e = ajouter(e, xp(10));
    expect(e.attente.map(f => f.genre)).toEqual(['xp', 'niveau', 'installation']);
  });

  it('deux gains à la même fin : une seule pastille, cumulée', () => {
    let e = pousser(FILE_VIDE, xp(20, 10));
    e = pousser(e, xp(5));
    expect(e.actif).toEqual(xp(25, 10));
    expect(e.attente).toEqual([]);
  });

  it('pendant un exercice : rien ne se pose sur la consigne, l’XP va dans la feuille de réussite', () => {
    let e = exercice(FILE_VIDE, true);
    e = pousser(e, xp(20, 10));
    e = pousser(e, niveau(2));
    expect(e.actif).toBeNull();
    expect(e.enLigne).toEqual({ points: 20, bonus: 10, vue: false });
    expect(e.attente).toEqual([niveau(2)]);
  });

  it("la fête de niveau attend la fin de l'exercice ; l'XP déjà lue dans la feuille n'est pas répétée", () => {
    let e = exercice(FILE_VIDE, true);
    e = pousser(pousser(e, xp(20)), niveau(2));
    e = marquerVue(e);
    e = avancer(exercice(e, false));
    expect(e.actif).toEqual(niveau(2));
    expect(e.attente).toEqual([]);
    expect(e.enLigne).toBeNull();
  });

  it("fin de leçon ou de partie : l'XP non lue passe avant le niveau", () => {
    let e = exercice(FILE_VIDE, true);
    e = pousser(pousser(e, xp(40)), niveau(3));
    e = avancer(exercice(e, false));
    expect(e.actif).toEqual(xp(40));
    expect(e.attente).toEqual([niveau(3)]);
  });

  it("un nouvel exercice efface la fête à l'écran et bloque la suite", () => {
    let e = pousser(pousser(FILE_VIDE, xp(10)), niveau(2));
    e = exercice(e, true);
    expect(e.actif).toBeNull();
    expect(avancer(e).actif).toBeNull();
    expect(e.attente).toEqual([niveau(2)]);
  });

  it('problème suivant (fin puis début dans le même rendu) : le niveau attend toujours', () => {
    let e = exercice(FILE_VIDE, true);
    e = marquerVue(pousser(pousser(e, xp(20)), niveau(2)));
    e = exercice(exercice(e, false), true);
    expect(avancer(e).actif).toBeNull();
    expect(e.attente).toEqual([niveau(2)]);
  });

  it('deux niveaux avant la fête : on fête le plus haut, une fois', () => {
    const e = ajouter(ajouter(exercice(FILE_VIDE, true), niveau(2)), niveau(3));
    expect(e.attente).toEqual([niveau(3)]);
  });

  it("la carte d'installation : une seule demande, retirée quand elle quitte l'écran", () => {
    let e = ajouter(ajouter(FILE_VIDE, installation), installation);
    expect(e.attente).toHaveLength(1);
    e = avancer(e);
    expect(e.actif).toEqual(installation);
    e = retirer(e, 'installation');
    expect(e.actif).toBeNull();
    expect(retirer(e, 'installation')).toBe(e);
  });

  it("terminer un autre genre ne ferme pas la fête à l'écran", () => {
    const e = pousser(FILE_VIDE, niveau(2));
    expect(terminer(e, 'xp')).toBe(e);
    expect(terminer(e, 'niveau').actif).toBeNull();
  });
});
