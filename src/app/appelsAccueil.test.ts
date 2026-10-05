// Issue #236 (N4) : un seul appel à la fois sur l'accueil.
import { describe, expect, it } from 'vitest';
import { appelSecondaire, etatTuile, lireJourAnnonce, type Contexte } from './appelsAccueil';

const ctx = (c: Partial<Contexte> = {}): Contexte =>
  ({ jour: 10, parties: 3, duJourFait: false, annonce: false, jourAnnonce: null, installation: false, ...c });

describe("appel secondaire de l'accueil", () => {
  it('premier lancement : pas de pastille « À faire », la première partie suffit', () => {
    const a = appelSecondaire(ctx({ parties: 0 }));
    expect(a).toBeNull();
    expect(etatTuile(a, false)).toBeNull();
  });

  it('après la première partie : « À faire » sur la tuile du Go du jour', () => {
    const a = appelSecondaire(ctx({ parties: 1 }));
    expect(a).toBe('aFaire');
    expect(etatTuile(a, false)).toBe('aFaire');
  });

  it('« Fait » reste affiché : c’est un constat, pas un appel', () => {
    expect(etatTuile(appelSecondaire(ctx({ duJourFait: true })), true)).toBe('fait');
    expect(etatTuile(appelSecondaire(ctx({ parties: 0, duJourFait: true })), true)).toBe('fait');
  });

  it("carte d'installation : elle prend la place de « À faire », jamais les deux", () => {
    const a = appelSecondaire(ctx({ installation: true }));
    expect(a).toBe('installation');
    expect(etatTuile(a, false)).toBeNull();
  });

  it("pas de carte d'installation le jour d'une annonce de Mochi, même après l'annonce", () => {
    expect(appelSecondaire(ctx({ installation: true, annonce: true }))).toBe('annonce');
    expect(appelSecondaire(ctx({ installation: true, jourAnnonce: 10 }))).toBe('aFaire');
    expect(appelSecondaire(ctx({ installation: true, jourAnnonce: 9 }))).toBe('installation');
  });

  it('une annonce en cours masque la pastille « À faire »', () => {
    const a = appelSecondaire(ctx({ annonce: true }));
    expect(etatTuile(a, false)).toBeNull();
  });

  it('lit le jour gardé avec tolérance', () => {
    expect(lireJourAnnonce(12)).toBe(12);
    expect(lireJourAnnonce('12')).toBeNull();
    expect(lireJourAnnonce(-1)).toBeNull();
    expect(lireJourAnnonce(null)).toBeNull();
  });
});

describe('#369 : bilan de la semaine passée', () => {
  it('passe après une annonce de Mochi, avant la carte d’installation et « À faire » ; jamais au premier lancement', () => {
    expect(appelSecondaire(ctx({ semaine: true }))).toBe('semaine');
    expect(appelSecondaire(ctx({ semaine: true, installation: true }))).toBe('semaine');
    expect(appelSecondaire(ctx({ semaine: true, annonce: true }))).toBe('annonce');
    expect(appelSecondaire(ctx({ semaine: true, parties: 0 }))).toBeNull();
    // Le bilan à l'écran : la tuile du Go du jour ne crie pas « À faire » en même temps.
    expect(etatTuile('semaine', false)).toBeNull();
    expect(etatTuile('semaine', true)).toBe('fait');
  });
});
