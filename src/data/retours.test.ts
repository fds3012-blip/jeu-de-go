// Retours en 3 questions (#537) : vérification du formulaire, envoi anonyme, erreurs, et contrat avec la migration.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADRESSE_CONTACT, CONSEILS, SOURCES, TEXTE_MAX, envoyerRetour, preparerRetour } from './retours';
import { CATALOGUE_RETOURS } from '../content/i18n/retours';

const MIGRATION = readFileSync(new URL('../../supabase/migrations/20261014150000_retours_joueurs.sql', import.meta.url), 'utf8');

function avecSupabase() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://projet.supabase.co/');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'cle-publique');
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('preparerRetour', () => {
  it('la question 1 est obligatoire', () => {
    expect(preparerRetour({ conseil: null, ameliorer: 'Super', source: 'ami', langue: 'fr' })).toEqual({ ok: false, erreur: 'conseil' });
  });

  it('texte rogné, vide = absent, coupé à 1 000 caractères (accents comptés comme un caractère)', () => {
    const v = preparerRetour({ conseil: 'oui', ameliorer: '  Plus de leçons.  ', source: null, langue: 'en' });
    expect(v).toEqual({ ok: true, corps: { p_conseil: 'oui', p_ameliorer: 'Plus de leçons.', p_source: null, p_langue: 'en' } });
    const blanc = preparerRetour({ conseil: 'non', ameliorer: ' \n ', source: 'club', langue: 'fr' });
    expect(blanc.ok && blanc.corps.p_ameliorer).toBeNull();
    const long = preparerRetour({ conseil: 'peut_etre', ameliorer: 'é'.repeat(TEXTE_MAX + 50), source: 'reseau', langue: 'fr' });
    expect(long.ok && [...long.corps.p_ameliorer!].length).toBe(TEXTE_MAX);
  });

  it('source inconnue ignorée', () => {
    const v = preparerRetour({ conseil: 'oui', ameliorer: '', source: 'tiktok' as never, langue: 'fr' });
    expect(v.ok && v.corps.p_source).toBeNull();
  });
});

describe('envoyerRetour', () => {
  const corps = { p_conseil: 'oui', p_ameliorer: 'Bien', p_source: 'ami', p_langue: 'fr' } as const;

  it('appel anonyme : clé publique seulement, ni cookie ni adresse d’origine ; « true » = envoyé', async () => {
    avecSupabase();
    const f = vi.fn(() => Promise.resolve(new Response('true', { status: 200 })));
    expect(await envoyerRetour(corps, f as unknown as typeof fetch)).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://projet.supabase.co/rest/v1/rpc/envoyer_retour');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(corps);
    expect(init.headers).toEqual({ apikey: 'cle-publique', Authorization: 'Bearer cle-publique', 'Content-Type': 'application/json' });
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
  });

  it('« false » = plafond atteint ; erreur HTTP ou réseau = serveur ; hors ligne ; sans Supabase = indisponible', async () => {
    avecSupabase();
    const rep = (corpsRep: string, status = 200) => vi.fn(() => Promise.resolve(new Response(corpsRep, { status }))) as unknown as typeof fetch;
    expect(await envoyerRetour(corps, rep('false'))).toEqual({ ok: false, erreur: 'limite' });
    expect(await envoyerRetour(corps, rep('{"code":"22023"}', 400))).toEqual({ ok: false, erreur: 'serveur' });
    expect(await envoyerRetour(corps, vi.fn(() => Promise.reject(new TypeError('réseau'))) as unknown as typeof fetch)).toEqual({ ok: false, erreur: 'serveur' });
    vi.stubGlobal('navigator', { onLine: false });
    expect(await envoyerRetour(corps, rep('true'))).toEqual({ ok: false, erreur: 'horsLigne' });
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect(await envoyerRetour(corps, rep('true'))).toEqual({ ok: false, erreur: 'indisponible' });
  });
});

describe('contrat avec la migration 20261014150000_retours_joueurs.sql', () => {
  it('mêmes noms d’arguments, mêmes valeurs permises, même longueur maximale', () => {
    const sig = /create or replace function public\.envoyer_retour\(([^)]*)\)/.exec(MIGRATION)![1];
    expect(sig.split(',').map(a => a.trim().split(/\s+/)[0])).toEqual(['p_conseil', 'p_ameliorer', 'p_source', 'p_langue']);
    expect(MIGRATION).toContain(`conseil in (${CONSEILS.map(c => `'${c}'`).join(', ')})`);
    expect(MIGRATION).toContain(`source in (${SOURCES.map(c => `'${c}'`).join(', ')})`);
    expect(MIGRATION).toContain(`char_length(ameliorer) between 1 and ${TEXTE_MAX}`);
    expect(MIGRATION).toMatch(/grant execute on function public\.envoyer_retour\(text, text, text, text\) to anon, authenticated;/);
    expect(MIGRATION).toMatch(/alter table public\.retours enable row level security;/);
    expect(MIGRATION).not.toMatch(/create policy/i);
  });

  it('chaque réponse a son libellé dans les deux langues ; l’adresse de contact est une adresse', () => {
    for (const l of ['fr', 'en'] as const) {
      for (const c of CONSEILS) expect(CATALOGUE_RETOURS[l][`conseil.${c}`]).toBeTruthy();
      for (const s of SOURCES) expect(CATALOGUE_RETOURS[l][`source.${s}`]).toBeTruthy();
    }
    expect(ADRESSE_CONTACT).toMatch(/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/);
  });
});
