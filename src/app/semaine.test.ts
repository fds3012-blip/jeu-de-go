import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Compteur, Objectif, Semaine } from './semaine';

// Environnement Node : un localStorage en mémoire suffit.
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, clear: () => memoire.clear() });

const S = await import('./semaine');
const { lundiDe, decaler, cibles, lireEtat, compter, bilanAMontrer, marquerBilanVu, progression, prochainObjectif, nouvelleSemaine,
  noterSemaine, etatSemaine, noterBilanVu, CIBLES_DEPART, PLAFONDS, SEMAINE_KEY } = S;

// Issue #369 : objectifs de la semaine et bilan de la semaine passée, sur l'appareil.
const avec = (lundi: string, compte: Partial<Record<Compteur, number>>, atteints: Objectif[] = []): Semaine =>
  ({ ...nouvelleSemaine(lundi, null), compte: { parties: 0, problemes: 0, erreurs: 0, goDuJour: 0, lecons: 0, ...compte }, atteints });

describe('semaine en heure de Paris', () => {
  it('commence le lundi à 0 h, heure de Paris, quel que soit le fuseau de l’appareil', () => {
    expect(lundiDe(new Date('2026-10-05T12:00:00+02:00'))).toBe('2026-10-05'); // lundi
    expect(lundiDe(new Date('2026-10-11T23:30:00+02:00'))).toBe('2026-10-05'); // dimanche soir
    // Dimanche 22 h 30 UTC = lundi 0 h 30 à Paris : déjà la semaine suivante.
    expect(lundiDe(new Date('2026-10-11T22:30:00Z'))).toBe('2026-10-12');
    expect(lundiDe(new Date('2026-09-27T12:00:00+02:00'))).toBe('2026-09-21'); // dimanche du lancement
    // Passage à l'heure d'hiver (25/10/2026) : la semaine suit le calendrier de Paris.
    expect(lundiDe(new Date('2026-10-26T00:30:00+01:00'))).toBe('2026-10-26');
    expect(decaler('2026-12-28', 7)).toBe('2027-01-04');
  });
});

describe('cibles personnelles', () => {
  it('départ 3 parties, 5 problèmes, 2 erreurs ; ensuite au moins la semaine d’avant, jamais plus que le plafond', () => {
    expect(cibles(null)).toEqual(CIBLES_DEPART);
    expect(cibles(avec('2026-09-28', { parties: 1, problemes: 9, erreurs: 40 }))).toEqual({ parties: 3, problemes: 9, erreurs: PLAFONDS.erreurs });
    // Une semaine sans lien avec la nouvelle (absence) ne relève pas les cibles.
    expect(nouvelleSemaine('2026-10-19', avec('2026-09-28', { problemes: 12 })).cibles).toEqual(CIBLES_DEPART);
    expect(nouvelleSemaine('2026-10-05', avec('2026-09-28', { problemes: 12 })).cibles.problemes).toBe(12);
  });
});

describe('compter et atteindre', () => {
  it('un objectif s’atteint une seule fois ; les compteurs sans objectif n’en atteignent jamais', () => {
    let e = lireEtat(null, '2026-10-05');
    let atteints: Objectif[] = [];
    for (let i = 0; i < 3; i++) ({ etat: e, atteints } = compter(e, 'parties'));
    expect(atteints).toEqual(['parties']);
    ({ etat: e, atteints } = compter(e, 'parties'));
    expect(atteints).toEqual([]);
    expect(progression(e.courante, 'parties')).toEqual({ fait: 3, cible: 3, atteint: true });
    expect(compter(e, 'goDuJour', 9).atteints).toEqual([]);
    expect(prochainObjectif(e.courante)).toBe('problemes');
    ({ etat: e } = compter(e, 'problemes', 5));
    ({ etat: e } = compter(e, 'erreurs', 2));
    expect(prochainObjectif(e.courante)).toBeNull();
    expect(compter(e, 'parties', -4).etat.courante.compte.parties).toBe(4);
  });
});

describe('bilan de la semaine passée', () => {
  it('montré une fois, au premier passage de la semaine suivante, puis plus avant la semaine d’après', () => {
    const passee = avec('2026-09-28', { parties: 2, goDuJour: 3 });
    let e = lireEtat({ courante: passee, precedente: null, bilanVu: null }, '2026-10-05');
    expect(e.precedente?.lundi).toBe('2026-09-28');
    expect(e.courante.lundi).toBe('2026-10-05');
    expect(bilanAMontrer(e)).toEqual(passee);
    e = marquerBilanVu(e, '2026-09-28');
    expect(bilanAMontrer(e)).toBeNull();
    // Toujours la même semaine : pas de retour, même relu.
    expect(bilanAMontrer(lireEtat(JSON.parse(JSON.stringify(e)), '2026-10-05'))).toBeNull();
    // La semaine suivante : le bilan de la semaine du 5, s'il y a eu de l'activité.
    const e2 = compter(e, 'problemes').etat;
    expect(bilanAMontrer(lireEtat(e2, '2026-10-12'))?.lundi).toBe('2026-10-05');
  });

  it('rien après une semaine vide, ni après une absence de plus d’une semaine', () => {
    expect(bilanAMontrer(lireEtat({ courante: avec('2026-09-28', {}), precedente: null, bilanVu: null }, '2026-10-05'))).toBeNull();
    expect(bilanAMontrer(lireEtat({ courante: avec('2026-09-21', { parties: 4 }), precedente: null, bilanVu: null }, '2026-10-05'))).toBeNull();
  });

  it('état abîmé ou horloge revenue en arrière : on repart proprement, sans erreur', () => {
    expect(lireEtat('n’importe quoi', '2026-10-05').courante).toEqual(nouvelleSemaine('2026-10-05', null));
    const abime = lireEtat({ courante: { lundi: '2026-10-05', compte: { parties: 'x', problemes: -3 }, cibles: { parties: 999 }, atteints: ['parties', 'pirate'] } }, '2026-10-05');
    expect(abime.courante.compte.parties).toBe(0);
    expect(abime.courante.compte.problemes).toBe(0);
    expect(abime.courante.cibles.parties).toBe(PLAFONDS.parties);
    expect(abime.courante.cibles.problemes).toBe(CIBLES_DEPART.problemes);
    expect(abime.courante.atteints).toEqual(['parties']);
    const futur = lireEtat({ courante: avec('2026-10-12', { parties: 2 }) }, '2026-10-05');
    expect(futur.courante.lundi).toBe('2026-10-12');
  });
});

describe('stockage sur l’appareil', () => {
  beforeEach(() => memoire.clear());
  it('note, change de semaine et garde le bilan vu', () => {
    const lundi = new Date('2026-10-05T09:00:00+02:00'), suivant = new Date('2026-10-13T09:00:00+02:00');
    expect(noterSemaine('erreurs', 1, lundi)).toEqual([]);
    expect(noterSemaine('erreurs', 1, lundi)).toEqual(['erreurs']);
    expect(etatSemaine(lundi).courante.compte.erreurs).toBe(2);
    const e = etatSemaine(suivant);
    expect(e.precedente?.compte.erreurs).toBe(2);
    expect(e.courante.cibles.erreurs).toBe(2);
    expect(bilanAMontrer(e)?.lundi).toBe('2026-10-05');
    noterBilanVu('2026-10-05', suivant);
    expect(bilanAMontrer(etatSemaine(suivant))).toBeNull();
    expect(JSON.parse(memoire.get(SEMAINE_KEY)!).bilanVu).toBe('2026-10-05');
  });

  it('stockage bloqué : rien ne casse', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } });
    expect(noterSemaine('parties')).toEqual([]);
    expect(etatSemaine().courante.compte.parties).toBe(0);
  });
});
