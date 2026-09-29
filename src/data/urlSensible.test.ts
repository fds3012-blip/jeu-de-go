import { describe, expect, it } from 'vitest';
import {
  PARAMS_SENSIBLES, nettoyerProprietes, nettoyerTexte, nettoyerUrl, posthogSansUrlSensible,
  sentryBreadcrumbSansUrlSensible, sentrySansUrlSensible,
} from './urlSensible';

const SECRETS = ['JETON_ACCES', 'JETON_RAFRAICHISSEMENT', 'CODE_PKCE', 'HASH_OTP', 'DEFI_SECRET', 'INVITE_SECRET', 'joueur@exemple.fr'];
const absents = (texte: string) => SECRETS.forEach(s => expect(texte).not.toContain(s));

// Retour du lien de connexion par e-mail (flux implicite de Supabase).
const RETOUR_LIEN =
  'https://go.example/#access_token=JETON_ACCES&expires_at=1759200000&expires_in=3600&refresh_token=JETON_RAFRAICHISSEMENT&token_type=bearer&type=magiclink';

describe('nettoyerUrl', () => {
  it('retire les jetons de session du fragment', () => {
    expect(nettoyerUrl(RETOUR_LIEN)).toBe('https://go.example/');
  });

  it('retire les jetons et codes de la requête, garde le reste dans l’ordre', () => {
    const url = 'https://go.example/partie?lang=fr&access_token=JETON_ACCES&code=CODE_PKCE&sb_flow_id=abc&refresh_token=JETON_RAFRAICHISSEMENT&komi=6.5';
    expect(nettoyerUrl(url)).toBe('https://go.example/partie?lang=fr&komi=6.5');
  });

  it('jetons dans la requête ET dans le fragment : rien ne subsiste', () => {
    const url = 'https://go.example/?token_hash=HASH_OTP&type=email&defi=DEFI_SECRET&invite=INVITE_SECRET&email=joueur%40exemple.fr#access_token=JETON_ACCES&refresh_token=JETON_RAFRAICHISSEMENT';
    const propre = nettoyerUrl(url);
    expect(propre).toBe('https://go.example/');
    absents(propre);
    expect(propre).not.toContain('joueur%40exemple.fr');
  });

  it('jeton du défi par lien (fragment nu) retiré', () => {
    expect(nettoyerUrl('https://go.example/defi#AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBe('https://go.example/defi');
  });

  it('clés sans tenir compte de la casse ni de l’encodage', () => {
    expect(nettoyerUrl('/x?Access_Token=a&%63ode=b&ok=1')).toBe('/x?ok=1');
  });

  it('erreur d’authentification (lien expiré) retirée', () => {
    expect(nettoyerUrl('https://go.example/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'))
      .toBe('https://go.example/');
    expect(nettoyerUrl('https://go.example/?error=access_denied&error_description=x')).toBe('https://go.example/');
  });

  it('adresse normale inchangée, caractère pour caractère', () => {
    for (const url of [
      'https://go.example',
      'https://go.example/',
      'https://go.example/problemes?lang=en&komi=6.5',
      'https://go.example/?utm_source=x&g=12',
      '/defi',
      '/partie?taille=9',
      '$direct',
      '',
    ]) expect(nettoyerUrl(url)).toBe(url);
  });

  it('paramètres dont le nom contient un mot sensible gardés (seuls les noms exacts sont retirés)', () => {
    expect(nettoyerUrl('/x?codec=h264&type_partie=rapide')).toBe('/x?codec=h264&type_partie=rapide');
  });

  it('liste documentée et sans doublon', () => {
    expect(new Set(PARAMS_SENSIBLES).size).toBe(PARAMS_SENSIBLES.length);
    for (const p of ['access_token', 'refresh_token', 'code', 'token', 'defi', 'invite', 'type']) expect(PARAMS_SENSIBLES).toContain(p);
  });
});

describe('nettoyerTexte', () => {
  it('nettoie les adresses dans un message libre', () => {
    const t = nettoyerTexte(`Échec de ${RETOUR_LIEN} puis de https://go.example/?code=CODE_PKCE.`);
    absents(t);
    expect(t).toContain('https://go.example/');
  });

  it('masque les paires sensibles hors adresse', () => {
    const t = nettoyerTexte('fragment : #access_token=JETON_ACCES&refresh_token=JETON_RAFRAICHISSEMENT&lang=fr');
    absents(t);
    expect(t).toContain('lang=fr');
  });

  it('texte ordinaire inchangé', () => {
    const t = 'Coup illégal en D4 (ko) : a=1';
    expect(nettoyerTexte(t)).toBe(t);
  });
});

describe('PostHog before_send', () => {
  it('nettoie $current_url, $referrer, $pathname, $initial_* et $session_entry_*', () => {
    const ev = posthogSansUrlSensible({
      event: 'app_ouverte',
      properties: {
        $current_url: RETOUR_LIEN,
        $referrer: 'https://go.example/?code=CODE_PKCE',
        $pathname: '/defi#DEFI_SECRET',
        $session_entry_url: RETOUR_LIEN,
        $initial_person_info: { r: '$direct', u: RETOUR_LIEN },
        $host: 'go.example',
        source: 'revue',
        coups: 12,
      },
      $set: { $current_url: RETOUR_LIEN },
      $set_once: { $initial_current_url: RETOUR_LIEN, $initial_pathname: '/?invite=INVITE_SECRET', $initial_referrer: '$direct' },
    });
    absents(JSON.stringify(ev));
    expect(ev.properties).toMatchObject({
      $current_url: 'https://go.example/', $referrer: 'https://go.example/', $pathname: '/defi',
      $host: 'go.example', source: 'revue', coups: 12,
    });
    expect(ev.$set_once).toMatchObject({ $initial_current_url: 'https://go.example/', $initial_pathname: '/', $initial_referrer: '$direct' });
  });

  it('événement normal inchangé ; événement rejeté laissé tel quel', () => {
    const props = { $current_url: 'https://go.example/problemes?lang=fr', $pathname: '/problemes', mesure: 'anonyme', vrai: true, rien: null };
    expect(posthogSansUrlSensible({ event: 'x', properties: { ...props } })).toEqual({ event: 'x', properties: props });
    expect(posthogSansUrlSensible(null)).toBeNull();
  });
});

describe('Sentry', () => {
  it('beforeSend nettoie request.url, Referer, query_string, messages et breadcrumbs', () => {
    const ev = sentrySansUrlSensible({
      message: `Erreur sur ${RETOUR_LIEN}`,
      request: {
        url: RETOUR_LIEN,
        query_string: 'code=CODE_PKCE',
        headers: { 'User-Agent': 'ua', Referer: 'https://go.example/?token_hash=HASH_OTP&type=email' },
      },
      exception: { values: [{ value: 'fetch https://x.supabase.co/auth/v1/verify?token=HASH_OTP&type=magiclink' }] },
      breadcrumbs: [{ category: 'navigation', data: { from: '/#access_token=JETON_ACCES', to: '/defi#DEFI_SECRET' } }],
      tags: { url: RETOUR_LIEN },
    });
    absents(JSON.stringify(ev));
    expect(ev.request?.url).toBe('https://go.example/');
    expect(ev.request?.headers?.['User-Agent']).toBe('ua');
    expect(ev.request).not.toHaveProperty('query_string');
    expect(ev.breadcrumbs?.[0].data).toEqual({ from: '/', to: '/defi' });
  });

  it('beforeBreadcrumb : navigation, fetch, xhr, console', () => {
    const nav = sentryBreadcrumbSansUrlSensible({ category: 'navigation', data: { from: '/', to: '/?defi=DEFI_SECRET#x' } });
    expect(nav.data).toEqual({ from: '/', to: '/' });
    const fetch = sentryBreadcrumbSansUrlSensible({
      category: 'fetch', data: { method: 'GET', url: 'https://x.supabase.co/auth/v1/user?access_token=JETON_ACCES', status_code: 401 },
    });
    expect(fetch.data).toEqual({ method: 'GET', url: 'https://x.supabase.co/auth/v1/user', status_code: 401 });
    const xhr = sentryBreadcrumbSansUrlSensible({ category: 'xhr', data: { method: 'POST', url: '/api?invite=INVITE_SECRET&page=2' } });
    expect(xhr.data?.url).toBe('/api?page=2');
    const console = sentryBreadcrumbSansUrlSensible({ category: 'console', message: `url : ${RETOUR_LIEN}` });
    absents(JSON.stringify([nav, fetch, xhr, console]));
    expect(sentryBreadcrumbSansUrlSensible(null)).toBeNull();
  });

  it('événement normal inchangé', () => {
    const ev = {
      message: 'Coup refusé',
      request: { url: 'https://go.example/partie?taille=9', headers: { 'User-Agent': 'ua' } },
      breadcrumbs: [{ category: 'navigation', data: { from: '/', to: '/problemes' } }],
    };
    expect(sentrySansUrlSensible(structuredClone(ev))).toEqual(ev);
  });
});

describe('nettoyerProprietes', () => {
  it('nettoie en profondeur (tableaux compris), sans toucher aux objets non simples', () => {
    const d = new Date(0);
    expect(nettoyerProprietes({ d }).d).toBe(d);
    expect(nettoyerProprietes({ a: { b: [{ url: RETOUR_LIEN }] } })).toEqual({ a: { b: [{ url: 'https://go.example/' }] } });
  });
});
