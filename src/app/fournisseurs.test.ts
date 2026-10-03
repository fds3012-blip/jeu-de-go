import { describe, expect, it } from 'vitest';
import { ORDRE_FOURNISSEURS, estFournisseur, fournisseursActifs, fournisseursVisibles, incidentRetour, listeNoms, messageIncident } from './fournisseurs';
import { contexteNavigateur } from './navigateurIntegre';

// #411 : un drapeau par fournisseur, ordre unique, visibilité, erreurs de retour.
const stock = (o: Record<string, string>) => ({ getItem: (k: string) => o[k] ?? null });
const CHROME = contexteNavigateur({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' });
const MESSENGER = contexteNavigateur({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/455.0]' });
const APP_IPHONE = contexteNavigateur({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', installee: true });

describe('drapeaux', () => {
  it('un drapeau par fournisseur, « 1 » seulement', () => {
    expect(fournisseursActifs({}, null)).toEqual([]);
    expect(fournisseursActifs({ VITE_AUTH_GOOGLE: '1' }, null)).toEqual(['google']);
    expect(fournisseursActifs({ VITE_AUTH_FACEBOOK: ' 1 ', VITE_AUTH_APPLE: 'true' }, null)).toEqual(['facebook']);
    expect(fournisseursActifs({ VITE_AUTH_GOOGLE: '', VITE_AUTH_APPLE: '0', VITE_AUTH_FACEBOOK: 'oui' }, null)).toEqual([]);
  });
  it('toujours dans le même ordre : Google, Apple, Facebook', () => {
    expect(ORDRE_FOURNISSEURS).toEqual(['google', 'apple', 'facebook']);
    expect(fournisseursActifs({ VITE_AUTH_FACEBOOK: '1', VITE_AUTH_APPLE: '1', VITE_AUTH_GOOGLE: '1' }, null)).toEqual(['google', 'apple', 'facebook']);
  });
  it('builds de test seulement : stockage `e2e.<fournisseur>`', () => {
    expect(fournisseursActifs({ VITE_E2E: '1' }, stock({ 'e2e.facebook': '1', 'e2e.google': '1' }))).toEqual(['google', 'facebook']);
    expect(fournisseursActifs({}, stock({ 'e2e.facebook': '1' }))).toEqual([]);
    expect(fournisseursActifs({ VITE_E2E: '1' }, { getItem: () => { throw new Error('interdit'); } })).toEqual([]);
  });
  it('reconnaît les fournisseurs, rien d’autre', () => {
    expect(['google', 'apple', 'facebook', 'discord', null, 3].map(estFournisseur)).toEqual([true, true, true, false, false, false]);
  });
});

describe('visibilité', () => {
  it('navigateur normal : les fournisseurs réglés', () => {
    expect(fournisseursVisibles(CHROME, ['facebook', 'google'])).toEqual(['google', 'facebook']);
    expect(fournisseursVisibles(CHROME, [])).toEqual([]);
  });
  it('navigateur intégré et app installée sur iPhone : aucun (le code reste)', () => {
    expect(fournisseursVisibles(MESSENGER, ['google', 'apple', 'facebook'])).toEqual([]);
    expect(fournisseursVisibles(APP_IPHONE, ['google', 'apple', 'facebook'])).toEqual([]);
  });
  it('noms pour l’aide « Tu préfères … ? »', () => {
    expect(listeNoms(['google'], 'ou')).toBe('Google');
    expect(listeNoms(['google', 'apple'], 'ou')).toBe('Google ou Apple');
    expect(listeNoms(['google', 'apple', 'facebook'], 'or')).toBe('Google, Apple or Facebook');
  });
});

describe('erreurs au retour', () => {
  it('annulé : Google et Facebook (access_denied), Apple (user_cancelled_authorize)', () => {
    expect(incidentRetour('#error=access_denied&error_description=The+user+denied')).toBe('annule');
    expect(incidentRetour('#error=user_cancelled_authorize')).toBe('annule');
    expect(incidentRetour('', '?error=access_denied&error_reason=user_denied')).toBe('annule');
  });
  it('identité déjà reliée à un autre compte', () => {
    expect(incidentRetour('#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user')).toBe('deja_lie');
    expect(incidentRetour('#error=invalid_request&error_description=Identity+is+already+linked+to+another+user')).toBe('deja_lie');
  });
  it('adresse déjà prise par un autre moyen, adresse à confirmer, liaison fermée, le reste', () => {
    expect(incidentRetour('#error=invalid_request&error_code=email_exists')).toBe('email_pris');
    expect(incidentRetour('#error=invalid_request&error_code=user_already_exists')).toBe('email_pris');
    expect(incidentRetour('#error=invalid_request&error_code=provider_email_needs_verification')).toBe('email_a_confirmer');
    expect(incidentRetour('#error=invalid_request&error_code=manual_linking_disabled')).toBe('liaison_fermee');
    expect(incidentRetour('#error=server_error&error_code=unexpected_failure')).toBe('erreur');
  });
  it('pas d’erreur : rien', () => {
    expect(incidentRetour('#access_token=abc&refresh_token=def')).toBeNull();
    expect(incidentRetour('#defi=' + 'A'.repeat(32))).toBeNull();
    expect(incidentRetour('', '')).toBeNull();
  });
  it('phrases claires, avec le nom du fournisseur, le code par e-mail en repli', () => {
    expect(messageIncident('annule', 'apple')).toBe('Connexion annulée. Réessaie, ou reçois un code par e-mail.');
    expect(messageIncident('erreur', 'facebook')).toBe('Facebook n’a pas répondu. Reçois plutôt un code par e-mail.');
    expect(messageIncident('email_pris', 'google')).toMatch(/^Ton adresse a déjà un compte, créé avec un autre moyen\. .*ajouter Google/);
    expect(messageIncident('email_a_confirmer', 'facebook')).toMatch(/^Facebook n’a pas confirmé ton adresse/);
  });
});
