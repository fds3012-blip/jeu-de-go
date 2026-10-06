import { describe, expect, it } from 'vitest';
import { aAppliquer, CLES_REGLAGES, DATE_ANCIENNE, entreeValide, entreesLocales, fusionner, nettoyer } from './reglagesCompte';
import { DEFAULTS } from './settings';

// Issue #448 : réglages synchronisés, « dernier changement gagne » clé par clé.
const T = Date.UTC(2026, 9, 6, 12);

describe('liste blanche', () => {
  it('accepte les clés et valeurs connues, refuse le reste', () => {
    expect(entreeValide('theme', { v: 'dark', t: T }, T)).toBe(true);
    expect(entreeValide('size', { v: 13, t: T }, T)).toBe(true);
    expect(entreeValide('themeGoban', { v: 'ardoise', t: 0 }, T)).toBe(true);
    expect(entreeValide('theme', { v: 'rose', t: T }, T)).toBe(false);
    expect(entreeValide('size', { v: '13', t: T }, T)).toBe(false);
    expect(entreeValide('email', { v: 'a@b.c', t: T }, T)).toBe(false);
    expect(entreeValide('toString', { v: 'x', t: T }, T)).toBe(false);
    expect(entreeValide('sound', { v: true, t: 1.5 }, T)).toBe(false);
    expect(entreeValide('sound', { v: true, t: -1 }, T)).toBe(false);
    expect(entreeValide('sound', { v: true, t: T + 2 * 86_400_000 }, T)).toBe(false);
    expect(entreeValide('sound', { v: true }, T)).toBe(false);
    expect(entreeValide('sound', null, T)).toBe(false);
  });

  it('chaque réglage du Profil est synchronisé, et rien d’autre que des choix fermés', () => {
    for (const k of Object.keys(DEFAULTS)) expect(Object.keys(CLES_REGLAGES)).toContain(k);
    expect(Object.keys(CLES_REGLAGES).sort()).toEqual([...Object.keys(DEFAULTS), 'enLigne', 'langue', 'messagesCoupes', 'themeGoban'].sort());
    for (const [k, v] of Object.entries(DEFAULTS)) expect(entreeValide(k, { v, t: T }, T)).toBe(true);
  });

  it('nettoie une réponse abîmée', () => {
    expect(nettoyer({ theme: { v: 'dark', t: 5 }, size: { v: 7, t: 5 }, autre: { v: 1, t: 1 }, sound: 'oui' }, T)).toEqual({ theme: { v: 'dark', t: 5 } });
    expect(nettoyer(null)).toEqual({});
    expect(nettoyer([1, 2])).toEqual({});
  });
});

describe('fusion « dernier changement gagne »', () => {
  const local = { theme: { v: 'dark', t: 300 }, size: { v: 13, t: 100 }, sound: { v: false, t: 200 } };
  const serveur = { theme: { v: 'light', t: 200 }, size: { v: 19, t: 150 }, sound: { v: true, t: 200 }, langue: { v: 'en', t: 50 } };

  it('garde, clé par clé, la date la plus récente ; à égalité, le serveur', () => {
    expect(fusionner(local, serveur)).toEqual({
      theme: { v: 'dark', t: 300 }, size: { v: 19, t: 150 }, sound: { v: true, t: 200 }, langue: { v: 'en', t: 50 },
    });
    expect(fusionner({}, serveur)).toEqual(serveur);
    expect(fusionner(local, {})).toEqual(local);
  });

  it('l’appareil n’applique que ce qui est plus récent chez le serveur (ou absent chez lui)', () => {
    expect(aAppliquer(local, serveur)).toEqual({ size: { v: 19, t: 150 }, sound: { v: true, t: 200 }, langue: { v: 'en', t: 50 } });
    // Même valeur et même date : rien à faire.
    expect(aAppliquer({ theme: { v: 'dark', t: 9 } }, { theme: { v: 'dark', t: 9 } })).toEqual({});
  });

  it('deux appareils convergent, quel que soit l’ordre des échanges', () => {
    const a = { theme: { v: 'dark', t: 10 }, coordonnees: { v: false, t: 30 } };
    const b = { theme: { v: 'light', t: 20 }, coordonnees: { v: true, t: 5 } };
    let s = fusionner(a, {});
    s = fusionner(b, s);
    const a2 = { ...a, ...aAppliquer(a, s) }, b2 = { ...b, ...aAppliquer(b, s) };
    expect(a2).toEqual(b2);
    expect(a2).toEqual({ theme: { v: 'light', t: 20 }, coordonnees: { v: false, t: 30 } });
  });
});

describe('réglages de l’appareil', () => {
  const defauts = { ...DEFAULTS, langue: null, enLigne: 'direct', messagesCoupes: false, themeGoban: 'kaya' };
  it('un réglage daté part avec sa date ; jamais changé, il ne part pas ; changé avant #448, il part avec une date ancienne', () => {
    const valeurs = { ...DEFAULTS, theme: 'dark', size: 13, langue: null, enLigne: 'lente', messagesCoupes: false, themeGoban: 'kaya' };
    expect(entreesLocales(valeurs, { size: 500 }, defauts, T)).toEqual({
      theme: { v: 'dark', t: DATE_ANCIENNE }, size: { v: 13, t: 500 }, enLigne: { v: 'lente', t: DATE_ANCIENNE },
    });
    // Remis à la valeur par défaut après un changement daté : il part (sinon l'ancien choix reviendrait du serveur).
    expect(entreesLocales({ sound: true }, { sound: 700 }, defauts, T)).toEqual({ sound: { v: true, t: 700 } });
    // Date de l'appareil trop en avance : ramenée à la limite acceptée par le serveur.
    expect(entreesLocales({ sound: false }, { sound: T * 2 }, defauts, T).sound.t).toBe(T + 86_400_000);
  });
});
