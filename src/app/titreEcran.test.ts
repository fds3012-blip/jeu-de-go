import { afterEach, describe, expect, it } from 'vitest';
import { choisirLangue } from '../content/i18n';
import { titreEcran } from './titreEcran';

describe('titre de l’onglet du navigateur (#465)', () => {
  afterEach(() => choisirLangue('fr'));

  it('garde le titre de l’app sur l’accueil (celui de index.html)', () => {
    expect(titreEcran({ quoi: 'accueil' })).toBe('Mochi Go : apprendre et jouer au go');
  });

  it('nomme l’écran, puis l’app', () => {
    expect(titreEcran({ quoi: 'onglet', onglet: 'problemes' })).toBe('Problèmes · Mochi Go');
    expect(titreEcran({ quoi: 'onglet', onglet: 'apprendre' })).toBe('Apprendre · Mochi Go');
    expect(titreEcran({ quoi: 'lecon', titre: 'Capturer une pierre' })).toBe('Capturer une pierre · Mochi Go');
    expect(titreEcran({ quoi: 'partie', contre: 'Pomme' })).toBe('Partie contre Pomme · Mochi Go');
    expect(titreEcran({ quoi: 'partie', contre: null })).toBe('Partie à deux · Mochi Go');
    expect(titreEcran({ quoi: 'partie', contre: 'Mochi', guidee: true })).toBe('Partie guidée · Mochi Go');
    expect(titreEcran({ quoi: 'direct' })).toBe('En direct · Mochi Go');
    expect(titreEcran({ quoi: 'lente' })).toBe('Partie lente · Mochi Go');
    expect(titreEcran({ quoi: 'defi' })).toBe('Défier un ami · Mochi Go');
  });

  it('suit la langue de l’interface (sans l’anglais chargé, le français reste)', () => {
    choisirLangue('en');
    // Le catalogue anglais n'est pas téléchargé dans ce test : repli sur le français, jamais une clé brute.
    expect(titreEcran({ quoi: 'onglet', onglet: 'profil' })).not.toMatch(/^titre\.|nav\./);
  });
});
