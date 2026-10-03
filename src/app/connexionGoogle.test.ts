import { describe, expect, it } from 'vitest';
import { CLE_RATTACHEMENT_ATTENTE, RETOUR_CONNEXION_KEY, RETOUR_MAX_MS, aRattacher, annoncer, definirRetour, garderRetour, lireAnnonce, lireRetour, oublierAnnonce, prendreRetour } from './connexionGoogle';
import { moyenConnexion, noterConnexionPar } from './entonnoir';
import { CLE_RATTACHEMENT } from '../data/rattachement';

// #354 : aller-retour chez Google, retour à l'action demandée (défi compris).
function memoire() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

describe('note d’aller-retour', () => {
  it('garde l’écran, l’action et le défi, puis les rend une seule fois', () => {
    const s = memoire();
    definirRetour({ raison: 'defi', reprise: { quoi: 'defis' }, defi: { jeton: 'J'.repeat(32), inviteur: 'Ami' }, profil: false });
    garderRetour(s, 1000);
    expect(JSON.parse(s.m.get(RETOUR_CONNEXION_KEY)!)).toMatchObject({ raison: 'defi', quand: 1000 });
    expect(prendreRetour(s, 2000)).toEqual({ raison: 'defi', reprise: { quoi: 'defis' }, defi: { jeton: 'J'.repeat(32), inviteur: 'Ami' }, profil: false,
      fournisseur: 'google', action: 'connexion' });
    expect(s.m.has(RETOUR_CONNEXION_KEY)).toBe(false);
    expect(prendreRetour(s, 2000)).toBeNull();
  });

  it('ignorée si trop vieille, venue du futur ou abîmée', () => {
    const note = (o: object) => JSON.stringify({ raison: 'parties', reprise: null, defi: null, profil: false, ...o });
    expect(lireRetour(note({ quand: 0 }), RETOUR_MAX_MS + 1)).toBeNull();
    expect(lireRetour(note({ quand: 10 * 60_000 }), 0)).toBeNull();
    expect(lireRetour('{pas du json', 0)).toBeNull();
    expect(lireRetour(null, 0)).toBeNull();
    expect(lireRetour(note({ quand: 5, reprise: { autre: 1 }, defi: { jeton: 3 }, fournisseur: 'myspace', action: 'pirater' }), 10))
      .toEqual({ raison: 'parties', reprise: null, defi: null, profil: false, fournisseur: 'google', action: 'connexion' });
  });

  it('sans stockage : rien ne casse', () => {
    expect(() => garderRetour(null)).not.toThrow();
    expect(prendreRetour(null)).toBeNull();
  });
});

describe('fournisseur et action (#411)', () => {
  it('garde le fournisseur choisi et ce qui était tenté', () => {
    const s = memoire();
    definirRetour({ raison: null, reprise: null, defi: null, profil: true });
    garderRetour(s, 1000, { fournisseur: 'facebook', action: 'ajout' });
    expect(prendreRetour(s, 1001)).toMatchObject({ profil: true, fournisseur: 'facebook', action: 'ajout' });
    garderRetour(s, 1000, { fournisseur: 'apple', action: 'liaison' });
    expect(prendreRetour(s, 1001)).toMatchObject({ fournisseur: 'apple', action: 'liaison' });
  });
  it('annonce lue sans être effacée, puis oubliée', () => {
    annoncer({ incident: 'deja_lie', fournisseur: 'google', action: 'liaison' });
    expect(lireAnnonce()).toEqual({ incident: 'deja_lie', fournisseur: 'google', action: 'liaison' });
    expect(lireAnnonce()).not.toBeNull();
    oublierAnnonce();
    expect(lireAnnonce()).toBeNull();
  });
  it('code de rattachement en attente : même clé que le module de rattachement', () => {
    expect(CLE_RATTACHEMENT_ATTENTE).toBe(CLE_RATTACHEMENT);
    const s = memoire();
    expect(aRattacher(s)).toBe(false);
    s.setItem(CLE_RATTACHEMENT, '{}');
    expect(aRattacher(s)).toBe(true);
    expect(aRattacher(null)).toBe(false);
  });
});

describe('mesure', () => {
  it('compte créé au retour d’un fournisseur : moyen `google`, `apple` ou `facebook`', () => {
    for (const f of ['google', 'apple', 'facebook'] as const) {
      noterConnexionPar(f);
      expect(moyenConnexion()).toBe(f);
    }
  });
});
