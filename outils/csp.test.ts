// En-têtes de sécurité (#531) : vercel.json et la balise meta CSP de chaque page (outils/csp.ts).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avecMetaCsp, directives, empreinte, entetesGlobaux, entetesPreversion, HOTES_E2E, scriptsEnLigne } from './csp';
import { LEGACY_MODEL_URL } from '../src/engine/katago/loader';
import { urlSgfOgs } from '../src/go/ogs';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const env = Object.fromEntries(readFileSync(new URL('../.env.example', import.meta.url), 'utf8').split('\n')
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const entete = (cle: string) => entetesGlobaux(vercel).find(e => e.key.toLowerCase() === cle.toLowerCase())?.value ?? '';
const csp = directives(entete('Content-Security-Policy'));

/** Vrai si une source CSP (`'self'` exclu) permet l'adresse : schéma, hôte (joker `*.`), comme les navigateurs. */
function permis(sources: string[], adresse: string): boolean {
  const u = new URL(adresse);
  return sources.some(s => {
    if (s === `${u.protocol}`) return true;
    const m = /^(https?:|wss?:)\/\/(\*\.)?([^/:]+)$/.exec(s);
    if (!m || m[1] !== u.protocol) return false;
    return m[2] ? u.hostname.endsWith(`.${m[3]}`) : u.hostname === m[3];
  });
}

describe('vercel.json : en-têtes de sécurité', () => {
  it('toutes les adresses, sans toucher aux réécritures ni aux autres en-têtes', () => {
    expect(vercel.headers[0].source).toBe('/(.*)');
    expect(vercel.rewrites.length).toBeGreaterThan(5);
    expect(vercel.headers.find((r: { source: string }) => r.source === '/reseaux/(.*)\\.bin\\.gz')).toBeTruthy();
  });

  it('HSTS deux ans, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options', () => {
    expect(entete('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains');
    expect(entete('X-Content-Type-Options')).toBe('nosniff');
    expect(entete('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(entete('X-Frame-Options')).toBe('DENY');
    for (const f of ['camera', 'microphone', 'geolocation', 'payment', 'browsing-topics']) expect(entete('Permissions-Policy')).toContain(`${f}=()`);
  });

  it('CSP bloquante : rien par défaut hors du site, pas d’eval, ni objet, ni cadre autour de l’app', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['form-action']).toEqual(["'self'"]);
    expect(entete('Content-Security-Policy')).not.toContain("'unsafe-eval'");
    expect(entetesGlobaux(vercel).some(e => /report-only/i.test(e.key))).toBe(false);
    // Les scripts en ligne passent l'en-tête (fixe) ; la balise meta de chaque page les limite à leurs empreintes.
    expect(csp['script-src']).toEqual(["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://challenges.cloudflare.com']);
    expect(csp['worker-src']).toEqual(["'self'", 'blob:']);
  });

  it('les services utilisés par l’app sont permis (.env.example, KataGo, OGS, Turnstile), pas un autre hôte', () => {
    const connect = csp['connect-src'];
    expect(permis(connect, env.VITE_SUPABASE_URL)).toBe(true);
    expect(permis(connect, env.VITE_SUPABASE_URL.replace('https:', 'wss:') + '/realtime/v1/websocket')).toBe(true);
    expect(permis(connect, env.VITE_POSTHOG_HOST + '/e/')).toBe(true);
    const dsn = new URL(env.VITE_SENTRY_DSN);
    expect(permis(connect, `https://${dsn.host}/api/1/envelope/`)).toBe(true);
    expect(permis(connect, LEGACY_MODEL_URL)).toBe(true);
    expect(permis(connect, urlSgfOgs(67000001))).toBe(true);
    expect(permis(csp['script-src'], 'https://challenges.cloudflare.com/turnstile/v0/api.js')).toBe(true);
    expect(permis(csp['frame-src'], 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/x')).toBe(true);
    for (const autre of ['https://evil.example/x', 'https://autre.supabase.co', 'https://us.i.posthog.com/e/', 'wss://evil.example'])
      expect(permis(connect, autre), autre).toBe(false);
    // Hôtes simulés des tests : jamais en production.
    for (const h of HOTES_E2E) expect(connect).not.toContain(h);
  });

  it('préversion : mêmes en-têtes, avec les hôtes simulés des tests en plus', () => {
    const pre = entetesPreversion(vercel);
    expect(pre.map(e => e.key)).toEqual(entetesGlobaux(vercel).map(e => e.key));
    const d = directives(pre.find(e => e.key === 'Content-Security-Policy')!.value);
    expect(d['connect-src']).toEqual([...csp['connect-src'], ...HOTES_E2E]);
    expect(d['script-src']).toEqual(csp['script-src']);
  });
});

describe('balise meta CSP de chaque page', () => {
  const page = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <script>var a = 1;</script>
    <script type="module" src="/assets/index.js"></script>
    <script type="application/ld+json">{"@type":"WebPage"}</script>
    <script type="application/json" id="demo-textes">{"a":1}</script>
  </head>
  <body><script>
  var b = 2;
</script></body>
</html>`;

  it('ne compte que les scripts en ligne exécutables', () => {
    expect(scriptsEnLigne(page)).toEqual(['var a = 1;', '\n  var b = 2;\n']);
  });

  it('empreinte SHA-256 en base 64 de chaque script, balise juste après <meta charset>, avant tout script', () => {
    const h = avecMetaCsp(page);
    const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]+)" \/>/.exec(h)!;
    expect(meta[1]).toBe(`script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com ${empreinte('var a = 1;')} ${empreinte('\n  var b = 2;\n')}`);
    expect(empreinte('var a = 1;')).toMatch(/^'sha256-[A-Za-z0-9+/]{43}='$/);
    expect(h.indexOf('<meta charset')).toBeLessThan(meta.index);
    expect(meta.index).toBeLessThan(h.indexOf('<script'));
  });

  it('rejouée sur une page déjà traitée (aperçus copiés d’index.html) : une seule balise, à jour', () => {
    const une = avecMetaCsp(page);
    expect(avecMetaCsp(une)).toBe(une);
    const changee = avecMetaCsp(une.replace('var a = 1;', 'var a = 2;'));
    expect(changee.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(1);
    expect(changee).toContain(empreinte('var a = 2;'));
    expect(changee).not.toContain(empreinte('var a = 1;'));
  });

  it('page sans <meta charset> : erreur de build plutôt qu’une page mal protégée', () => {
    expect(() => avecMetaCsp('<html><head><script>x()</script></head></html>')).toThrow(/meta charset/);
  });

  it('index.html du dépôt : la balise viendra avant ses scripts en ligne', () => {
    const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(scriptsEnLigne(index).length).toBeGreaterThanOrEqual(3);
    const h = avecMetaCsp(index);
    expect(h.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(h.indexOf('<script'));
  });
});
