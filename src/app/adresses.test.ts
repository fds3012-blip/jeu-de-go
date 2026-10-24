import { describe, expect, it } from 'vitest';
import { cheminDe, estCheminApp, lireAdresse, RUBRIQUES, type Adresse } from './adresses';
import { THEMES } from '../content/themesLecons';

describe('adresses par écran (C6, N8)', () => {
  it('chaque écran fait l’aller-retour : chemin, puis écran', () => {
    const ecrans: Adresse[] = [
      { onglet: 'jouer' }, { onglet: 'apprendre' }, { onglet: 'apprendre', theme: 'vie-mort' }, { onglet: 'apprendre', ouvertures: true },
      { onglet: 'apprendre', avecMochi: true }, { onglet: 'apprendre', lecon: 'l5' }, { onglet: 'problemes' }, { onglet: 'problemes', probleme: 'a01' },
      { onglet: 'profil' }, ...RUBRIQUES.map((r): Adresse => ({ onglet: 'profil', rubrique: r })),
    ];
    for (const e of ecrans) expect(lireAdresse(cheminDe(e), THEMES)).toEqual(e);
    for (const th of THEMES) expect(lireAdresse(`/apprendre/${th}`, THEMES)).toEqual({ onglet: 'apprendre', theme: th });
  });

  it('les chemins attendus', () => {
    expect(cheminDe({ onglet: 'apprendre', lecon: 'l5' })).toBe('/apprendre/lecon/l5');
    expect(cheminDe({ onglet: 'apprendre', theme: 'capture' })).toBe('/apprendre/capture');
    expect(cheminDe({ onglet: 'problemes', probleme: 'a01' })).toBe('/problemes/a01');
    expect(cheminDe({ onglet: 'profil', rubrique: 'reglages' })).toBe('/profil/reglages');
    // Une rubrique qui ne se rouvre pas seule (profil d'un joueur, étude) : le sommaire.
    expect(cheminDe({ onglet: 'profil', rubrique: 'joueur' })).toBe('/profil');
    expect(lireAdresse('/apprendre/lecon/l5/', THEMES)).toEqual({ onglet: 'apprendre', lecon: 'l5' });
  });

  it('chemins d’avant ou inconnus : null (l’app fait comme avant)', () => {
    for (const c of ['/confidentialite', '/j/12', '/apprendre-le-go', '/regles-du-go', '/en', '/apprendre/inconnu', '/apprendre/lecon',
      '/profil/joueur', '/profil/etude', '/problemes/a01/b', '/apprendre/<script>', '/problemes/' + 'a'.repeat(60), '/apprendre/Capture']) {
      expect(lireAdresse(c, THEMES), c).toBeNull();
    }
    expect(lireAdresse('/', THEMES)).toEqual({ onglet: 'jouer' });
    expect(lireAdresse('', THEMES)).toEqual({ onglet: 'jouer' });
  });

  it('chemins de l’app, pour le service worker et la réécriture', () => {
    for (const c of ['/', '/apprendre', '/apprendre/lecon/l5', '/problemes/a01', '/profil/reglages']) expect(estCheminApp(c), c).toBe(true);
    for (const c of ['/apprendre-le-go', '/regles-du-go', '/j/3', '/en', '/en/learn-go', '/profils']) expect(estCheminApp(c), c).toBe(false);
  });
});
