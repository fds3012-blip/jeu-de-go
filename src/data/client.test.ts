import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';
import { COMPTES, _reinitialiserClient, chargerSupabase, configSupabase, sessionProbable, supabaseCharge } from './client';

// #401 : supabase-js (≈ 57 Ko gzip) hors du JS initial. Budget vérifié sur le build par scripts/budget-bundle.mjs ;
// ce test garde les imports dans le code, sur le modèle de src/app/aFaire.test.ts.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(e => {
    const p = join(dossier, e.name);
    if (e.isDirectory()) return fichiers(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$|\.setup\.ts$|\.d\.ts$/.test(e.name) ? [p] : [];
  });
}
/** Imports statiques en valeur (pas `import type`) : `import … from '…'` et `import '…'`. */
const statiques = (src: string) => [
  ...[...src.matchAll(/^import (?!type )[^;]*?from '([^']+)'/gms)].map(m => m[1]),
  ...[...src.matchAll(/^import '([^']+)'/gm)].map(m => m[1]),
];
const dynamiques = (src: string) => [...src.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map(m => m[1]);
const versSupabase = (f: string, m: string) => resolve(dirname(f), m) === join(SRC, 'data/supabase');

describe('imports critiques du JS initial (#401, budget)', () => {
  const app = fichiers(SRC).map(f => ({ f, nom: relative(SRC, f), src: readFileSync(f, 'utf8') }));

  it('aucun module n’importe le client Supabase ni supabase-js en valeur : seulement en type', () => {
    const fautifs = app.filter(({ nom }) => nom !== 'data/supabase.ts')
      .flatMap(({ f, nom, src }) => statiques(src).filter(m => m.startsWith('@supabase/') || versSupabase(f, m)).map(m => `${nom} → ${m}`));
    expect(fautifs).toEqual([]);
  });

  it('seul src/data/client.ts charge le client, par import()', () => {
    const charges = app.flatMap(({ f, nom, src }) => dynamiques(src).filter(m => m.startsWith('@supabase/') || versSupabase(f, m)).map(() => nom));
    expect(charges).toEqual(['data/client.ts']);
  });

  it('PostHog, Sentry et TensorFlow.js ne sont jamais importés en statique', () => {
    const fautifs = app.flatMap(({ nom, src }) => statiques(src).filter(m => /^(posthog-js|@sentry\/|@tensorflow\/)/.test(m)).map(m => `${nom} → ${m}`));
    expect(fautifs).toEqual([]);
  });

  it('le démarrage charge le client tout de suite seulement si le premier écran en dépend, sinon après', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    expect(main).toMatch(/if \(JETON_AU_CHARGEMENT !== null \|\| chargementUrgent\(\)\) void chargerSupabase\(\);/);
    expect(main).toMatch(/apresPremierEcran\(\(\) => \{[^}]*void chargerSupabase\(\);/s);
    expect(main).toContain('ecouterErreursAvantSentry();');
  });
});

describe('configSupabase', () => {
  it('URL et clé publique valides, sinon null (comme createSupabase)', () => {
    expect(configSupabase({})).toBeNull();
    expect(configSupabase({ VITE_SUPABASE_URL: 'pas une url', VITE_SUPABASE_ANON_KEY: 'cle' })).toBeNull();
    expect(configSupabase({ VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_ANON_KEY: 'cle' })).toEqual({ url: 'https://x.supabase.co', key: 'cle' });
  });
});

describe('sessionProbable : faut-il le client pour le premier écran ?', () => {
  const stockage = (cles: string[]) => ({ length: cles.length, key: (i: number) => cles[i] ?? null });

  it('premier lancement : ni session enregistrée, ni retour de connexion', () => {
    expect(sessionProbable(stockage([]), '')).toBe(false);
    expect(sessionProbable(stockage(['go.parties.v1', 'go.consentement.v1']), '?go-du-jour=6')).toBe(false);
    expect(sessionProbable(undefined, '')).toBe(false);
  });

  it('session de supabase-js sur l’appareil (`sb-<hôte>-auth-token`)', () => {
    expect(sessionProbable(stockage(['go.parties.v1', 'sb-xjvsalkvpgcjrznznxoi-auth-token']), '')).toBe(true);
    expect(sessionProbable(stockage(['sb-supabase-auth-token']), '')).toBe(true);
  });

  it('retour d’un lien de connexion ou de Google : jetons ou erreur dans l’adresse', () => {
    expect(sessionProbable(stockage([]), '#access_token=abc&refresh_token=def&type=magiclink')).toBe(true);
    expect(sessionProbable(stockage([]), '#error=access_denied&error_code=otp_expired&error_description=x')).toBe(true);
    expect(sessionProbable(stockage([]), '#erreur-test')).toBe(false);
  });

  it('stockage illisible : pas de session', () => {
    expect(sessionProbable({ get length(): number { throw new Error('bloqué'); }, key: () => null }, '')).toBe(false);
  });
});

describe('chargerSupabase', () => {
  afterEach(() => { _reinitialiserClient(); vi.unstubAllGlobals(); });
  const faux = { auth: {} } as unknown as Db;

  it('sans variables d’environnement (tests) : pas de comptes, null tout de suite, rien n’est importé', async () => {
    expect(COMPTES).toBe(false);
    const importer = vi.fn(() => Promise.resolve({ supabase: faux }));
    expect(supabaseCharge()).toBeNull();
    await expect(chargerSupabase(importer)).resolves.toBeNull();
    expect(importer).not.toHaveBeenCalled();
  });

  it('avec comptes : un seul import, publié aux abonnés ; nouvel essai après un échec réseau', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'cle');
    vi.resetModules();
    const C = await import('./client');
    expect(C.COMPTES).toBe(true);
    expect(C.supabaseCharge()).toBeUndefined(); // en chargement : ni « pas de comptes », ni client

    const echec = vi.fn(() => Promise.reject(new Error('réseau')));
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    await expect(C.chargerSupabase(echec, [0])).resolves.toBeNull();
    expect(echec).toHaveBeenCalledTimes(2); // un nouvel essai espacé avant d'abandonner
    expect(C.supabaseCharge()).toBeNull();
    expect((window.addEventListener as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('online');

    const importer = vi.fn(() => Promise.resolve({ supabase: faux }));
    const [a, b] = await Promise.all([C.chargerSupabase(importer), C.chargerSupabase(importer)]);
    expect(a).toBe(faux);
    expect(b).toBe(faux);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(C.supabaseCharge()).toBe(faux);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
