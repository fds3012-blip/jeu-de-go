// Socle i18n (issue #167) : couverture des clés, textes non vides, variables, pluriels, choix de la langue.
import { CATALOGUES, LANGUES, choisirLangue, detecterLangue, langue, t, traduire, type Cle } from './index';
import { fr } from './fr';
import type { Catalogue } from './types';

const cles = Object.keys(fr) as Cle[];
const textes = (v: unknown): string[] => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>));
const variables = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('catalogues', () => {
  for (const l of LANGUES) {
    it(`${l} : exactement les clés du français, aucun texte vide`, () => {
      expect(Object.keys(CATALOGUES[l]).sort()).toEqual([...cles].sort());
      for (const k of cles) for (const s of textes(CATALOGUES[l][k])) expect(s.trim(), `${l} ${k}`).not.toBe('');
    });

    it(`${l} : mêmes variables et même forme (texte ou pluriel) que le français`, () => {
      for (const k of cles) {
        expect(typeof CATALOGUES[l][k], k).toBe(typeof fr[k]);
        const attendu = [...new Set(textes(fr[k]).flatMap(variables))].sort();
        for (const s of textes(CATALOGUES[l][k])) expect(variables(s), `${l} ${k}`).toEqual(attendu);
        if (typeof fr[k] !== 'string') expect(CATALOGUES[l][k]).toHaveProperty('other');
      }
    });
  }

  it('le typage refuse un catalogue incomplet', () => {
    // @ts-expect-error : clé 'nav.jouer' (et les autres) manquante.
    const incomplet: Catalogue = { 'nav.aria': 'x' };
    expect(incomplet).toBeDefined();
  });
});

describe('t', () => {
  afterEach(() => choisirLangue('fr'));

  it('rend le français à l\'identique', () => {
    choisirLangue('fr');
    expect(t('nav.problemes')).toBe('Problèmes');
    expect(t('profil.cote', { cote: 1500 })).toBe('Cote 1500');
    expect(t('profil.gobanVerrou', { nom: 'Kaya', niveau: 5 })).toBe('Kaya, débloqué au niveau 5');
  });

  it('bascule en anglais', () => {
    choisirLangue('en');
    expect(langue()).toBe('en');
    expect(t('nav.problemes')).toBe('Puzzles');
    expect(t('profil.reglages')).toBe('Settings');
  });

  it('accorde les pluriels selon la langue (0 est singulier en français, pluriel en anglais)', () => {
    expect([0, 1, 2, 12].map(n => traduire('fr', 'profil.jours', { n }))).toEqual(['0 jour', '1 jour', '2 jours', '12 jours']);
    expect([0, 1, 2, 12].map(n => traduire('en', 'profil.jours', { n }))).toEqual(['0 days', '1 day', '2 days', '12 days']);
  });

  it('refuse au typage une variable manquante', () => {
    // @ts-expect-error : `cote` est obligatoire.
    expect(t('profil.cote')).toBe('Cote {cote}');
  });
});

describe('detecterLangue', () => {
  it('?lang= l\'emporte sur l\'appareil', () => {
    expect(detecterLangue('?lang=en', ['fr-FR'])).toBe('en');
    expect(detecterLangue('?x=1&lang=FR', ['en-US'])).toBe('fr');
  });
  it('suit la première langue connue de l\'appareil', () => {
    expect(detecterLangue('', ['en-GB', 'fr'])).toBe('en');
    expect(detecterLangue('', ['de-DE', 'fr-CA'])).toBe('fr');
    expect(detecterLangue('', ['es', 'en_US'])).toBe('en');
  });
  it('se replie sur le français (langue inconnue ou paramètre invalide)', () => {
    expect(detecterLangue('?lang=xx', ['de'])).toBe('fr');
    expect(detecterLangue('', [])).toBe('fr');
  });
});
