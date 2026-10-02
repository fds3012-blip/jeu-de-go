import { describe, expect, it } from 'vitest';
import { categoriserErreur, cleExplication, estErreurDeChargement, messageDe, messageSur } from './robustesse';

describe('robustesse : catégorie des erreurs (#325)', () => {
  it('reconnaît un écran chargé à la demande qui n’est pas arrivé (Chrome, Firefox, Safari, Vite)', () => {
    for (const m of [
      'Failed to fetch dynamically imported module: https://go.app/assets/Profil-abc.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/x.css',
    ]) {
      expect(estErreurDeChargement(new TypeError(m))).toBe(true);
      expect(categoriserErreur(new TypeError(m))).toBe('chargement');
    }
    const e = new Error('x'); e.name = 'ChunkLoadError';
    expect(categoriserErreur(e)).toBe('chargement');
  });

  it('lit l’erreur portée par un événement vite:preloadError', () => {
    const ev = { type: 'vite:preloadError', payload: new TypeError('Failed to fetch dynamically imported module: /assets/a.js') };
    expect(estErreurDeChargement(ev)).toBe(true);
    expect(messageDe(ev)).toContain('dynamically imported');
  });

  it('classe un appel réseau raté', () => {
    expect(categoriserErreur(new TypeError('Failed to fetch'))).toBe('reseau');
    expect(categoriserErreur(new TypeError('NetworkError when attempting to fetch resource.'))).toBe('reseau');
    expect(categoriserErreur(new TypeError('Load failed'))).toBe('reseau');
    // Hors ligne, un TypeError inconnu est traité comme réseau ; en ligne, non.
    expect(categoriserErreur(new TypeError('x is not a function'), true)).toBe('reseau');
    expect(categoriserErreur(new TypeError('x is not a function'), false)).toBe('rendu');
  });

  it('tout le reste est un bogue de rendu', () => {
    expect(categoriserErreur(new Error('Cannot read properties of undefined'))).toBe('rendu');
    expect(categoriserErreur('texte')).toBe('rendu');
    expect(categoriserErreur(null)).toBe('rendu');
    expect(categoriserErreur(undefined)).toBe('rendu');
  });

  it('choisit la phrase : hors ligne d’abord, puis selon la catégorie', () => {
    expect(cleExplication('chargement', true)).toBe('erreur.horsLigne');
    expect(cleExplication('reseau', true)).toBe('erreur.horsLigne');
    expect(cleExplication('rendu', true)).toBe('erreur.rendu');
    expect(cleExplication('chargement', false)).toBe('erreur.chargement');
    expect(cleExplication('reseau', false)).toBe('erreur.reseau');
    expect(cleExplication('rendu', false)).toBe('erreur.rendu');
  });

  it('messageSur : nettoyé (adresse sans jeton) et borné', () => {
    const m = messageSur(new Error('Failed to fetch https://x.app/?code=SECRET#access_token=JETON'));
    expect(m).not.toContain('SECRET');
    expect(m).not.toContain('JETON');
    expect(m).toContain('https://x.app/');
    expect(messageSur(new Error('a'.repeat(500)))).toHaveLength(200);
    expect(messageSur(null)).toBe('');
  });
});
