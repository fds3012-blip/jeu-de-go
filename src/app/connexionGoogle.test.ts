import { describe, expect, it } from 'vitest';
import { RETOUR_CONNEXION_KEY, RETOUR_MAX_MS, definirRetour, erreurRetour, garderRetour, googleActive, lireRetour, messageRetour, prendreRetour } from './connexionGoogle';
import { moyenConnexion, noterConnexionParGoogle } from './entonnoir';

// #354 : aller-retour chez Google, retour à l'action demandée (défi compris).
function memoire() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

describe('activation', () => {
  it('VITE_AUTH_GOOGLE=1 seulement ; absente ou autre valeur : rien', () => {
    expect(googleActive({ VITE_AUTH_GOOGLE: '1' })).toBe(true);
    expect(googleActive({ VITE_AUTH_GOOGLE: ' 1 ' })).toBe(true);
    expect(googleActive({})).toBe(false);
    expect(googleActive({ VITE_AUTH_GOOGLE: 'true' })).toBe(false);
    expect(googleActive({ VITE_AUTH_GOOGLE: '' })).toBe(false);
  });
});

describe('note d’aller-retour', () => {
  it('garde l’écran, l’action et le défi, puis les rend une seule fois', () => {
    const s = memoire();
    definirRetour({ raison: 'defi', reprise: { quoi: 'defis' }, defi: { jeton: 'J'.repeat(32), inviteur: 'Ami' }, profil: false });
    garderRetour(s, 1000);
    expect(JSON.parse(s.m.get(RETOUR_CONNEXION_KEY)!)).toMatchObject({ raison: 'defi', quand: 1000 });
    expect(prendreRetour(s, 2000)).toEqual({ raison: 'defi', reprise: { quoi: 'defis' }, defi: { jeton: 'J'.repeat(32), inviteur: 'Ami' }, profil: false });
    expect(s.m.has(RETOUR_CONNEXION_KEY)).toBe(false);
    expect(prendreRetour(s, 2000)).toBeNull();
  });

  it('ignorée si trop vieille, venue du futur ou abîmée', () => {
    const note = (o: object) => JSON.stringify({ raison: 'parties', reprise: null, defi: null, profil: false, ...o });
    expect(lireRetour(note({ quand: 0 }), RETOUR_MAX_MS + 1)).toBeNull();
    expect(lireRetour(note({ quand: 10 * 60_000 }), 0)).toBeNull();
    expect(lireRetour('{pas du json', 0)).toBeNull();
    expect(lireRetour(null, 0)).toBeNull();
    expect(lireRetour(note({ quand: 5, reprise: { autre: 1 }, defi: { jeton: 3 } }), 10)).toEqual({ raison: 'parties', reprise: null, defi: null, profil: false });
  });

  it('sans stockage : rien ne casse', () => {
    expect(() => garderRetour(null)).not.toThrow();
    expect(prendreRetour(null)).toBeNull();
  });
});

describe('retour en échec', () => {
  it('annulé (access_denied) ou erreur, dans le fragment ou la requête', () => {
    expect(erreurRetour('#error=access_denied&error_description=The+user+denied')).toBe('annule');
    expect(erreurRetour('#error=server_error&error_code=unexpected_failure')).toBe('erreur');
    expect(erreurRetour('', '?error=access_denied')).toBe('annule');
    expect(erreurRetour('#access_token=abc&refresh_token=def')).toBeNull();
    expect(erreurRetour('#defi=' + 'A'.repeat(32))).toBeNull();
  });
  it('phrases claires, le code par e-mail en repli', () => {
    expect(messageRetour('annule')).toBe('Connexion annulée. Réessaie, ou reçois un code par e-mail.');
    expect(messageRetour('erreur')).toBe('Google n’a pas répondu. Reçois plutôt un code par e-mail.');
  });
});

describe('mesure', () => {
  it('compte créé au retour de Google : moyen `google`', () => {
    noterConnexionParGoogle();
    expect(moyenConnexion()).toBe('google');
  });
});
