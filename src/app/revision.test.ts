import { describe, expect, it } from 'vitest';
import { numeroDuJour } from './goDuJour';
import {
  ECHEANCES, ETAT_VIDE, PAR_JOUR, aFaire, apresRevision, dus, lireRevision, noterRedite, prochain, revisionDuJour, revisionFaite, synchroniser, vuRecemment,
  type EtatRevision
} from './revision';

// Dates simulées, à heure fixe de Paris : les jours sont les numéros du Go du jour (27/09/2026 = n° 1).
const jour = (iso: string) => numeroDuJour(new Date(`${iso}T12:00:00+02:00`));
const J = jour('2026-10-01');

describe('calendrier J+1, J+3, J+7 (#199)', () => {
  it('les échéances sont 1, 3 et 7 jours après la réussite, 3 exercices par jour', () => {
    expect(ECHEANCES).toEqual([1, 3, 7]);
    expect(PAR_JOUR).toBe(3);
  });

  it('un problème réussi aujourd’hui ne revient que demain', () => {
    const e = synchroniser(ETAT_VIDE, ['b1'], J);
    expect(e.suivis.b1).toEqual({ base: J, etape: 0 });
    expect(dus(e, J)).toEqual([]);
    expect(dus(e, J + 1)).toEqual(['b1']);
  });

  it('synchroniser ne remet pas à zéro un problème déjà suivi', () => {
    const e1 = synchroniser(ETAT_VIDE, ['b1'], J);
    const e2 = synchroniser(e1, ['b1', 'b2'], J + 2);
    expect(e2.suivis.b1).toEqual({ base: J, etape: 0 });
    expect(e2.suivis.b2).toEqual({ base: J + 2, etape: 0 });
    expect(synchroniser(e2, ['b1'], J + 5)).toBe(e2); // rien de neuf : même objet
  });

  it('réussi à chaque passage : J+1, J+3, J+7, puis acquis', () => {
    let e = synchroniser(ETAT_VIDE, ['b1'], J);
    const passages: number[] = [];
    for (let d = J; d <= J + 30; d++) {
      e = revisionDuJour(e, d);
      const id = aFaire(e, d);
      if (id) { passages.push(d - J); e = apresRevision(e, id, true, d); }
    }
    expect(passages).toEqual([1, 3, 7]);
    expect(prochain(e.suivis.b1)).toBeNull();
    expect(dus(e, J + 100)).toEqual([]);
  });

  it('raté (ou résolu avec aide) : on repart de ce jour, retour à J+1', () => {
    let e = synchroniser(ETAT_VIDE, ['b1'], J);
    e = revisionDuJour(e, J + 1);
    e = apresRevision(e, 'b1', true, J + 1); // J+1 réussi
    e = revisionDuJour(e, J + 3);
    e = apresRevision(e, 'b1', false, J + 3); // J+3 raté
    expect(e.suivis.b1).toEqual({ base: J + 3, etape: 0 });
    expect(prochain(e.suivis.b1)).toBe(J + 4);
    expect(revisionFaite(e, J + 3)).toBe(true); // résolu quand même : la révision du jour est faite
  });

  it('en retard : l’échéance suivante ne tombe jamais aujourd’hui', () => {
    let e = synchroniser(ETAT_VIDE, ['b1'], J);
    // Le joueur revient seulement à J+6 : l’échéance J+1 est due, il réussit.
    e = revisionDuJour(e, J + 6);
    expect(aFaire(e, J + 6)).toBe('b1');
    e = apresRevision(e, 'b1', true, J + 6);
    expect(prochain(e.suivis.b1)).toBe(J + 7); // J+3 était déjà passé : demain au plus tôt
    e = revisionDuJour(e, J + 7);
    e = apresRevision(e, 'b1', true, J + 7);
    expect(prochain(e.suivis.b1)).toBe(J + 11); // J+7 compté depuis la base décalée (J+4)
  });
});

describe('sélection du jour', () => {
  const base: EtatRevision = {
    suivis: { a: { base: J - 5, etape: 0 }, b: { base: J - 1, etape: 0 }, c: { base: J - 3, etape: 1 }, d: { base: J - 2, etape: 0 }, e: { base: J, etape: 0 } },
    jour: null,
  };

  it('3 exercices dus, les plus en retard d’abord ; pas ceux d’aujourd’hui', () => {
    expect(dus(base, J)).toEqual(['a', 'd', 'b', 'c']);
    const e = revisionDuJour(base, J);
    expect(e.jour).toEqual({ numero: J, ids: ['a', 'd', 'b'], faits: [] });
  });

  it('seulement les problèmes encore disponibles', () => {
    expect(dus(base, J, new Set(['b', 'c']))).toEqual(['b', 'c']);
  });

  it('la sélection tient toute la journée, puis change le lendemain', () => {
    let e = revisionDuJour(base, J);
    e = apresRevision(e, 'a', true, J);
    expect(revisionDuJour(e, J)).toBe(e);
    expect(aFaire(e, J)).toBe('d');
    e = apresRevision(e, 'd', true, J);
    e = apresRevision(e, 'b', false, J);
    expect(aFaire(e, J)).toBeUndefined();
    expect(revisionFaite(e, J)).toBe(true);
    const demain = revisionDuJour(e, J + 1);
    expect(demain.jour?.numero).toBe(J + 1);
    expect(demain.jour?.ids).toContain('b'); // raté hier : revient à J+1
    expect(revisionFaite(demain, J + 1)).toBe(false);
  });

  it('rien à réviser : aucune révision, rien de gardé', () => {
    const e = revisionDuJour(synchroniser(ETAT_VIDE, ['b1'], J), J);
    expect(e.jour).toBeNull();
    expect(aFaire(e, J)).toBeUndefined();
    expect(revisionFaite(e, J)).toBe(false);
  });

  it('une révision d’hier non finie ne compte pas aujourd’hui', () => {
    const e: EtatRevision = { ...base, jour: { numero: J - 1, ids: ['a'], faits: ['a'] } };
    expect(revisionFaite(e, J)).toBe(false);
    expect(aFaire(e, J)).toBeUndefined();
  });

  it('un exercice hors sélection ne change pas la liste du jour', () => {
    let e = revisionDuJour(base, J);
    e = apresRevision(e, 'c', true, J);
    expect(e.jour?.faits).toEqual([]);
  });
});

describe('lecture du stockage', () => {
  it('écarte ce qui est mal formé', () => {
    expect(lireRevision(null)).toEqual(ETAT_VIDE);
    expect(lireRevision('x')).toEqual(ETAT_VIDE);
    const e = lireRevision({ suivis: { a: { base: 3, etape: 1 }, b: { base: 'x', etape: 0 }, c: null, d: { base: 1, etape: 9 } }, jour: { numero: 4, ids: ['a', 2], faits: [] } });
    expect(e.suivis).toEqual({ a: { base: 3, etape: 1 }, d: { base: 1, etape: 3 } });
    expect(e.jour).toEqual({ numero: 4, ids: ['a'], faits: [] });
  });
});

describe('pas de redite le lendemain (#237, N3)', () => {
  // Jour J : leçon 1 (étape « capture »), puis pratique « Première capture » (b1) ou Go du jour b1, identique à l'étape.
  it('un problème réussi en redite hier ne revient pas dans la révision du jour', () => {
    let e = synchroniser(ETAT_VIDE, ['b1', 'a01'], J);
    e = noterRedite(e, 'b1', J);
    expect(vuRecemment(e, 'b1', J)).toBe(true);
    expect(vuRecemment(e, 'b1', J + 1)).toBe(true);
    expect(dus(e, J + 1)).toEqual(['a01']);
    expect(revisionDuJour(e, J + 1).jour?.ids).toEqual(['a01']);
    // Le surlendemain, il revient (en retard) comme les autres.
    expect(vuRecemment(e, 'b1', J + 2)).toBe(false);
    expect(dus(e, J + 2)).toEqual(['a01', 'b1']);
  });

  it('les notes de plus d’un jour sont oubliées, et la révision les garde', () => {
    let e = noterRedite(ETAT_VIDE, 'b1', J);
    e = noterRedite(e, 'a01', J + 1);
    expect(e.recents).toEqual({ b1: J, a01: J + 1 });
    e = noterRedite(e, 'a02', J + 3);
    expect(e.recents).toEqual({ a02: J + 3 });
    // Les autres fonctions ne perdent pas les notes.
    e = synchroniser(e, ['c1'], J + 3);
    e = revisionDuJour(e, J + 3);
    e = apresRevision(e, 'c1', true, J + 3);
    expect(e.recents).toEqual({ a02: J + 3 });
  });

  it('relit les notes gardées sur l’appareil', () => {
    expect(lireRevision({ suivis: {}, jour: null, recents: { b1: 5, x: 'y' } }).recents).toEqual({ b1: 5 });
    expect(lireRevision({ suivis: {}, jour: null })).toEqual(ETAT_VIDE);
  });
});
