// Socle i18n (issue #167) : couverture des clés, textes non vides, variables, pluriels, choix de la langue.
import { CATALOGUES, DETECTION_APPAREIL, LANGUES, LANGUE_KEY, choisirLangue, detecterLangue, langue, lireChoixLangue, memoriserChoixLangue, t, traduire, type Cle } from './index';
import { fr } from './fr';
import type { Catalogue } from './types';

const cles = Object.keys(fr) as Cle[];
const textes = (v: unknown): string[] => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>));
const variables = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort();

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
        // Une forme plurielle peut taire `n` (« ta première leçon »), jamais les autres variables.
        const sansN = (v: string[]) => (typeof fr[k] === 'string' ? v : v.filter(x => x !== 'n'));
        for (const s of textes(CATALOGUES[l][k])) expect(sansN(variables(s)), `${l} ${k}`).toEqual(sansN(attendu));
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

describe('detecterLangue : Profil > ?lang > appareil > français', () => {
  it('le choix du Profil l\'emporte sur ?lang et sur l\'appareil', () => {
    expect(detecterLangue('?lang=en', ['en-US'], true, 'fr')).toBe('fr');
    expect(detecterLangue('?lang=fr', ['fr-FR'], true, 'en')).toBe('en');
    expect(detecterLangue('', ['en-GB'], true, 'fr')).toBe('fr');
  });
  it('un choix absent ou invalide est ignoré', () => {
    expect(detecterLangue('?lang=en', ['fr-FR'], true, null)).toBe('en');
    expect(detecterLangue('', ['en-US'], true, 'de')).toBe('en');
  });
  it('?lang= l\'emporte sur l\'appareil', () => {
    expect(detecterLangue('?lang=en', ['fr-FR'])).toBe('en');
    expect(detecterLangue('?x=1&lang=FR', ['en-US'])).toBe('fr');
  });
  it('détection de l\'appareil activée : un appareil en anglais ouvre l\'app en anglais', () => {
    expect(DETECTION_APPAREIL).toBe(true);
    expect(detecterLangue('', ['en-US'])).toBe('en');
    expect(detecterLangue('', ['en-GB', 'fr'])).toBe('en');
    expect(detecterLangue('', ['en_US'])).toBe('en');
    expect(detecterLangue('', ['fr-FR', 'en-US'])).toBe('fr');
  });
  it('la première langue traduite de la liste l\'emporte : l\'espagnol qui accepte l\'anglais s\'ouvre en anglais', () => {
    expect(detecterLangue('', ['es', 'en_US'])).toBe('en');
    expect(detecterLangue('', ['es-ES', 'de', 'en-GB', 'fr'])).toBe('en');
    expect(detecterLangue('', ['de-DE', 'fr-CA', 'en'])).toBe('fr');
  });
  it('sans langue traduite dans la liste, l\'app s\'ouvre en français', () => {
    expect(detecterLangue('', ['ja-JP'])).toBe('fr');
    expect(detecterLangue('', ['es-ES', 'de-DE'])).toBe('fr');
  });
  it('détection coupée : français, sauf ?lang ou choix du Profil', () => {
    expect(detecterLangue('', ['en-US'], false)).toBe('fr');
    expect(detecterLangue('', ['en-US'], false, 'en')).toBe('en');
  });
  it('se replie sur le français (langue inconnue, paramètre invalide, aucune langue)', () => {
    expect(detecterLangue('?lang=xx', ['de'])).toBe('fr');
    expect(detecterLangue('', [])).toBe('fr');
  });
});

describe('choix de la langue gardé sur l\'appareil', () => {
  const memoire = new Map<string, string>();
  beforeEach(() => vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); } }));
  afterEach(() => { memoire.clear(); vi.unstubAllGlobals(); });
  it('lit et écrit go.langue.v1', () => {
    expect(LANGUE_KEY).toBe('go.langue.v1');
    expect(lireChoixLangue()).toBeNull();
    memoriserChoixLangue('en');
    expect(localStorage.getItem('go.langue.v1')).toBe('"en"');
    expect(lireChoixLangue()).toBe('en');
    memoire.set(LANGUE_KEY, '"xx"');
    expect(lireChoixLangue()).toBeNull();
    memoire.set(LANGUE_KEY, '{oups');
    expect(lireChoixLangue()).toBeNull();
  });
});
