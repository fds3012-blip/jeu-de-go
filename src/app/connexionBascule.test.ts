import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../data/supabase';
import { adresseDejaPrise, aucunCompte, envoyerCodeConnexion } from '../data/account';
import { garderMonCompte } from '../data/defi';
import { apresRefus, demandeAge, typeCode, voieEnvoi } from './connexionBascule';

// #353 : « Cette adresse a déjà un compte » ne bloque plus. Florian : ancienne session anonyme + vrai compte.

describe('voie d’envoi du code', () => {
  it('création sans session, liaison avec une session anonyme, connexion si « J’ai déjà un compte »', () => {
    expect(voieEnvoi('creer', false)).toBe('creation');
    expect(voieEnvoi('creer', true)).toBe('liaison');
    expect(voieEnvoi('connecter', false)).toBe('connexion');
    expect(voieEnvoi('connecter', true)).toBe('connexion');
  });

  it('le code se vérifie en `email`, sauf la liaison (`email_change`)', () => {
    expect(typeCode('creation')).toBe('email');
    expect(typeCode('connexion')).toBe('email');
    expect(typeCode('liaison')).toBe('email_change');
  });

  it('la case d’âge n’est demandée qu’à la création', () => {
    expect(demandeAge('creer')).toBe(true);
    expect(demandeAge('connecter')).toBe(false);
  });
});

describe('après un refus', () => {
  it('adresse déjà prise pendant une liaison : bascule en connexion', () => {
    expect(apresRefus('liaison', 'pris')).toEqual({ faire: 'basculer' });
  });
  it('aucun compte en connexion : renvoie vers la création', () => {
    expect(apresRefus('connexion', 'inconnu')).toEqual({ faire: 'creer' });
  });
  it('autres cas : simple message', () => {
    expect(apresRefus('liaison', undefined)).toEqual({ faire: 'erreur' });
    expect(apresRefus('creation', 'pris')).toEqual({ faire: 'erreur' });
    expect(apresRefus('connexion', 'pris')).toEqual({ faire: 'erreur' });
  });
});

describe('lecture des erreurs Supabase', () => {
  it('adresse déjà prise : `email_exists`, ou 422 sans code (anciens serveurs)', () => {
    expect(adresseDejaPrise({ status: 422, code: 'email_exists', message: 'A user with this email address has already been registered' })).toBe(true);
    expect(adresseDejaPrise({ status: 422 })).toBe(true);
    expect(adresseDejaPrise({ status: 422, code: 'same_email' })).toBe(false);
    expect(adresseDejaPrise({ status: 429 })).toBe(false);
    expect(adresseDejaPrise(null)).toBe(false);
  });

  it('aucun compte : `otp_disabled` ou « Signups not allowed for otp »', () => {
    expect(aucunCompte({ status: 422, code: 'otp_disabled' })).toBe(true);
    expect(aucunCompte({ status: 400, message: 'Signups not allowed for otp' })).toBe(true);
    expect(aucunCompte({ status: 429, code: 'over_email_send_rate_limit' })).toBe(false);
  });
});

describe('envoi du code de connexion (compte existant)', () => {
  const avec = (error: unknown) => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error });
    const signOut = vi.fn();
    return { db: { auth: { signInWithOtp, signOut } } as unknown as Db, signInWithOtp, signOut };
  };

  it('ne crée jamais de compte et ne touche pas à la session en place', async () => {
    const c = avec(null);
    vi.stubGlobal('window', { location: { origin: 'https://go.exemple' } });
    expect(await envoyerCodeConnexion(c.db, ' fds@exemple.test ')).toEqual({ ok: true, value: null });
    vi.unstubAllGlobals();
    expect(c.signInWithOtp).toHaveBeenCalledWith({ email: 'fds@exemple.test', options: { emailRedirectTo: 'https://go.exemple', shouldCreateUser: false } });
    expect(c.signOut).not.toHaveBeenCalled();
  });

  it('adresse inconnue : « Aucun compte avec cette adresse. Crée ton compte. »', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://go.exemple' } });
    const r = await envoyerCodeConnexion(avec({ status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' }).db, 'x@y.fr');
    vi.unstubAllGlobals();
    expect(r).toEqual({ ok: false, error: 'Aucun compte avec cette adresse. Crée ton compte.', raison: 'inconnu' });
  });

  it('trop d’essais : message dédié, sans raison de bascule', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://go.exemple' } });
    const r = await envoyerCodeConnexion(avec({ status: 429 }).db, 'x@y.fr');
    vi.unstubAllGlobals();
    expect(r.ok).toBe(false);
    expect('raison' in r && r.raison).toBeFalsy();
  });
});

describe('liaison d’une session anonyme (garderMonCompte)', () => {
  const avec = (error: unknown) => ({ auth: { updateUser: vi.fn().mockResolvedValue({ data: {}, error }) } }) as unknown as Db;
  it('adresse déjà prise : raison `pris` (l’écran bascule en connexion)', async () => {
    const r = await garderMonCompte(avec({ status: 422, code: 'email_exists' }), 'fds@exemple.test', 'https://go.exemple');
    expect(r).toEqual({ ok: false, error: 'Cette adresse a déjà un compte. Utilise une autre adresse.', raison: 'pris' });
  });
  it('autre refus : pas de bascule', async () => {
    const r = await garderMonCompte(avec({ status: 500 }), 'a@b.fr', 'https://go.exemple');
    expect(r.ok).toBe(false);
    expect('raison' in r).toBe(false);
  });
});
