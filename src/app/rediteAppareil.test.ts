import { describe, expect, it } from 'vitest';
import { repriseDeLeconFaite } from './rediteAppareil';
import { dus, noterRedite, revisionDuJour, synchroniser, ETAT_VIDE } from './revision';
import { numeroDuJour } from './goDuJour';
import { LESSONS } from '../content/lessons';
import { ALL_PUZZLES } from '../content/puzzles';
import { PROCHES_DE_LECON, repriseFaite } from '../content/redites';
import { parsePuzzles } from '../data/puzzles';

// #251 (recette du 28/09, M3 et M2) : un Go du jour qui reprend une étape de leçon n'est une redite
// que si le joueur a vraiment fait cette étape.
const banque = parsePuzzles(ALL_PUZZLES);
const pz = (id: string) => banque.find(p => p.id === id)!;
const lecon = (id: string) => LESSONS.find(l => l.id === id)!;

describe('redite de leçon : seulement si l’étape est faite (M3)', () => {
  it('« Vers le bord » (b2) reprend l’étape 5 de la leçon 3 : redite seulement une fois cette étape passée', () => {
    const b2 = pz('b2');
    expect(repriseDeLeconFaite(b2, {})).toBe(false); // stockage vide, jamais ouvert de leçon : le cas de la recette
    expect(repriseDeLeconFaite(b2, { l1: 6, l2: 6 })).toBe(false); // d'autres leçons ne comptent pas
    expect(repriseDeLeconFaite(b2, { l3: 4 })).toBe(false); // leçon 3 commencée, étape 5 pas encore faite
    expect(repriseDeLeconFaite(b2, { l3: 5 })).toBe(true);
    expect(repriseDeLeconFaite(b2, { l3: 8 })).toBe(true);
  });

  it('un problème qui ne reprend aucune leçon n’est jamais une redite', () => {
    const complet = Object.fromEntries(LESSONS.map(l => [l.id, l.steps.length]));
    expect(repriseDeLeconFaite(pz('a02'), complet)).toBe(false);
  });

  it('liste d’exclusion (étape non notée) : il faut la leçon finie', () => {
    const l1 = lecon('l1');
    expect(PROCHES_DE_LECON.l1).toContain('a01');
    expect(repriseFaite(pz('a01'), l1, 0)).toBe(false);
    expect(repriseFaite(pz('a01'), l1, l1.steps.length - 1)).toBe(false);
    expect(repriseFaite(pz('a01'), l1, l1.steps.length)).toBe(true);
  });
});

describe('le débutant a une révision le lendemain du Go du jour (M2)', () => {
  const J = numeroDuJour(new Date('2026-09-28T12:00:00+02:00'));
  const liste = new Set(banque.map(p => p.id));

  it('Go du jour « Vers le bord » vu avec l’aide, sans leçon : il revient à J+1', () => {
    // Jour J : il entre dans la révision (vus compris), et n'est pas noté en redite (ni leçon faite, ni réussi seul).
    let etat = synchroniser(ETAT_VIDE, ['b2'], J);
    expect(repriseDeLeconFaite(pz('b2'), {})).toBe(false);
    expect(dus(etat, J, liste)).toEqual([]); // pas le jour même
    etat = revisionDuJour(etat, J + 1, liste);
    expect(etat.jour?.ids).toEqual(['b2']);
  });

  it('même avec la leçon faite, un Go du jour vu avec l’aide revient à J+1 (seul un Go du jour réussi seul est une redite)', () => {
    // Puzzles.tsx : noterRediteAppareil seulement si `gain.palier` (réussi sans voir la réponse).
    const reussiSeul = synchroniser(noterRedite(ETAT_VIDE, 'b2', J), ['b2'], J);
    expect(dus(reussiSeul, J + 1, liste)).toEqual([]); // #237 : redite, il saute J+1
    expect(dus(reussiSeul, J + 2, liste)).toEqual(['b2']);
    const vuAvecAide = synchroniser(ETAT_VIDE, ['b2'], J);
    expect(dus(vuAvecAide, J + 1, liste)).toEqual(['b2']);
  });
});
