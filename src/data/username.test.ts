import { validateUsername, usernameErrorFromDb, isEmail, USERNAME_MAX } from './username';

describe('validateUsername', () => {
  it('accepte un pseudo valide et retire les espaces autour', () => {
    expect(validateUsername('  Florian_42 ')).toEqual({ ok: true, value: 'Florian_42' });
    expect(validateUsername('go-go')).toEqual({ ok: true, value: 'go-go' });
  });

  it('respecte les longueurs de 3 à 24 caractères', () => {
    expect(validateUsername('ab').ok).toBe(false);
    expect(validateUsername('abc').ok).toBe(true);
    expect(validateUsername('a'.repeat(USERNAME_MAX)).ok).toBe(true);
    expect(validateUsername('a'.repeat(USERNAME_MAX + 1)).ok).toBe(false);
    expect(validateUsername('   ').ok).toBe(false);
  });

  it('refuse accents, espaces internes et symboles', () => {
    for (const bad of ['Sébastien', 'jean paul', 'go!', 'a.b.c', 'emoji😀x']) {
      const r = validateUsername(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Lettres sans accent/);
    }
  });
});

describe('usernameErrorFromDb', () => {
  it('explique un pseudo déjà pris', () => {
    expect(usernameErrorFromDb('23505')).toMatch(/déjà pris/);
    expect(usernameErrorFromDb('23514')).toMatch(/pas valide/);
    expect(usernameErrorFromDb(undefined)).toMatch(/Réessaie/);
  });
});

describe('isEmail', () => {
  it('reconnaît une adresse plausible', () => {
    expect(isEmail(' toi@exemple.fr ')).toBe(true);
    expect(isEmail('toi@exemple')).toBe(false);
    expect(isEmail('pas une adresse')).toBe(false);
  });
});
