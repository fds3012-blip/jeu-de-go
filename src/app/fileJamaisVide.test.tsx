// Issue #436 : plus jamais de file vide. Logique pure du repli contre l'IA, bande de la file pendant la partie IA,
// garde-fous statiques de la migration, appel du refus. Les règles du serveur elles-mêmes sont testées sur un vrai
// Postgres par supabase/tests/file_jamais_vide.test.sql ; les parcours par e2e/file-jamais-vide.spec.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPPONENTS } from '../engine';
import { PARAMS_DEFAUT, REPLI_MS, adversaireDuRepli, coteDuRang, proposerRepli } from './direct';
import { VeilleFile } from './VeilleFile';
import { refuserPartieDirect } from '../data/direct';
import { EVENTS } from '../data/analytics';
import { CATALOGUE_DIRECT, traduireDirect } from '../content/i18n/direct';
import { ATTENTE_MS } from '../go/pendule';
import type { Db } from '../data/supabase';

const dossier = resolve(__dirname, '../../supabase/migrations');
const FICHIER = '20261005090100_file_jamais_vide.sql';
const sql = readFileSync(resolve(dossier, FICHIER), 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

describe('file par défaut et repli (#436)', () => {
  it('file par défaut : 9 × 9, 10 min + 3 × 30 s, comptage japonais', () => {
    expect(PARAMS_DEFAUT).toEqual({ taille: 9, cadence: 'normale', regles: 'japanese' });
  });

  it('cote d’un adversaire de l’échelle d’après son rang (3000 − 100 × kyu)', () => {
    expect(coteDuRang('20 kyu')).toBe(1000);
    expect(coteDuRang('10 kyu')).toBe(2000);
    expect(coteDuRang('1 kyu')).toBe(2900);
    expect(coteDuRang('1 dan')).toBe(3000);
    expect(coteDuRang('fort')).toBeNull();
    // Chaque adversaire de l'échelle a une cote, du plus faible au plus fort.
    const cotes = OPPONENTS.map(o => coteDuRang(o.rang));
    expect(cotes.every(c => typeof c === 'number')).toBe(true);
    expect([...cotes].sort((a, b) => a! - b!)).toEqual(cotes);
  });

  it('l’IA du repli est celle de l’échelle la plus proche de la cote du joueur', () => {
    expect(adversaireDuRepli(OPPONENTS, 2000).id).toBe('renard');
    expect(adversaireDuRepli(OPPONENTS, 2080).id).toBe('renard');
    expect(adversaireDuRepli(OPPONENTS, 300).id).toBe('pomme');
    expect(adversaireDuRepli(OPPONENTS, 1500).id).toBe('caillou');
    expect(adversaireDuRepli(OPPONENTS, 3600).id).toBe('sensei');
    // À égale distance, la plus faible ; sans cote connue, celle d'un joueur qui connaît les règles (800).
    expect(adversaireDuRepli(OPPONENTS, 1550).id).toBe('caillou');
    expect(adversaireDuRepli(OPPONENTS, null).id).toBe('pomme');
    expect(adversaireDuRepli(OPPONENTS, Number.NaN).id).toBe('pomme');
  });

  it('proposé au bout de 25 s, en ligne, une seule fois par attente', () => {
    expect(REPLI_MS).toBe(25_000);
    expect(proposerRepli(24_999, true, false)).toBe(false);
    expect(proposerRepli(25_000, true, false)).toBe(true);
    expect(proposerRepli(60_000, false, false)).toBe(false);
    expect(proposerRepli(60_000, true, true)).toBe(false);
    // La présence dans la file tient : le client rappelle find_match bien avant les 30 s de purge du serveur.
    expect(ATTENTE_MS).toBeLessThan(30_000 / 3);
  });

  it('textes honnêtes : l’IA est nommée comme telle, rien de classé, aucun compteur de joueurs', () => {
    expect(traduireDirect('fr', 'direct.repli.mochi', { nom: 'Renard' }))
      .toBe('Personne de ton niveau pour l’instant. Joue contre Renard en attendant : je te préviens si quelqu’un arrive.');
    expect(traduireDirect('fr', 'direct.repli.detail', { nom: 'Renard' })).toBe('Renard est une IA. Cette partie n’est pas classée.');
    expect(traduireDirect('fr', 'direct.veille.pret')).toBe('Un joueur est prêt !');
    expect(traduireDirect('fr', 'direct.veille.rejoindre')).toBe('Rejoindre');
    expect(traduireDirect('fr', 'direct.veille.rester')).toBe('Rester');
    for (const l of ['fr', 'en'] as const) {
      for (const [cle, texte] of Object.entries(CATALOGUE_DIRECT[l])) {
        if (!/repli|veille|reglagesAutre/.test(cle)) continue;
        expect(texte, cle).not.toMatch(/en ligne|online|\d+ joueurs|\d+ players/i);
      }
    }
  });

  it('mesure : file_repli_ia', () => {
    expect(EVENTS.fileRepliIa).toBe('file_repli_ia');
  });
});

describe('bande de la file pendant la partie contre l’IA', () => {
  const db = { rpc: () => { throw new Error('aucun appel au rendu'); } } as unknown as Db;
  const rendu = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/[\u00a0\u202f]/g, ' ');
  beforeEach(() => { vi.stubGlobal('navigator', { onLine: true }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('dit que la recherche continue, et permet d’arrêter (cible de 44 px, sans compteur)', () => {
    const html = rendu(<VeilleFile db={db} demande={PARAMS_DEFAUT} depuis={0} onRejoindre={() => {}} onArret={() => {}} />);
    expect(html).toContain('Je cherche toujours un joueur pour toi.');
    expect(html).toContain('Ne plus chercher');
    expect(html).toContain('aria-label="Recherche d’un joueur"');
    expect(html).not.toMatch(/Rejoindre|en ligne/);
  });
});

describe('données : refuser la partie trouvée', () => {
  it('appelle refuser_partie_direct et lit le booléen', async () => {
    const appels: unknown[] = [];
    const db = { rpc: async (nom: string, args: unknown) => { appels.push([nom, args]); return { data: true, error: null }; } } as unknown as Db;
    expect(await refuserPartieDirect(db, 'p1')).toEqual({ ok: true, value: true });
    expect(appels).toEqual([['refuser_partie_direct', { p_partie: 'p1' }]]);
    const refus = { rpc: async () => ({ data: null, error: { code: 'P0002' } }) } as unknown as Db;
    expect(await refuserPartieDirect(refus, 'p1')).toEqual({ ok: false, error: 'introuvable' });
  });
});

describe('migration file_jamais_vide', () => {
  it('passe après toutes les migrations existantes, et sa find_match garde le contrôle du compte', () => {
    const toutes = readdirSync(dossier).filter(f => f.endsWith('.sql')).sort();
    expect(toutes.indexOf(FICHIER)).toBeGreaterThan(toutes.indexOf('20261004180100_partie_en_direct.sql'));
    expect(sql).toMatch(/find_match[\s\S]*?v_uid uuid := public\.exiger_compte_avec_pseudo\(\);/);
  });

  it('aucune donnée supprimée hors de la file ; aucune fonction ni table retirée', () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column|policy|trigger|function|schema)\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/disable row level security|no force row level security/i);
    expect(sql).not.toMatch(/create table/i);
    expect(new Set([...sql.matchAll(/\bdelete\s+from\s+([\w.]+)/gi)].map(m => m[1]))).toEqual(new Set(['public.match_queue']));
    expect(sql.replace(/\$\$[\s\S]*?\$\$/g, '')).not.toMatch(/\bdelete\s+from\b/i);
  });

  it('security definer à search_path vide, fermées à anon, cote jamais touchée', () => {
    const fonctions = [...sql.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\$\$([\s\S]*?)\$\$;/g)];
    expect(fonctions.map(f => f[1]).sort()).toEqual(['find_match', 'refuser_partie_direct']);
    for (const f of fonctions) expect(f[2], f[1]).toMatch(/security definer set search_path = ''/);
    for (const n of ['find_match(smallint, text, text)', 'refuser_partie_direct(uuid)']) {
      expect(sql).toContain(`revoke execute on function public.${n} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${n} to authenticated;`);
    }
    expect(sql).not.toMatch(/apply_game_rating|rating_history|update public\.profiles/);
  });

  it('élargit après 30 s, avec les réglages de qui attendait le plus ; garde l’écart de cote de #417', () => {
    expect(sql).toContain("c_elargir constant interval := interval '30 seconds'");
    expect(sql).toContain('or now() - least(q.created_at, coalesce(v_depuis, now())) >= c_elargir');
    expect(sql).toContain('abs(q.rating - v_rating) <= 100 + sqrt(q.rd * q.rd + v_rd * v_rd) / 2');
    expect(sql).toContain('if v_depuis is not null and v_depuis < v_q.created_at then');
    expect(sql).toMatch(/find_match\(p_size smallint, p_cadence text default 'normale', p_regles text default 'japanese'\)/);
  });

  it('le refus annule seulement avant d’avoir joué, sans cote', () => {
    const corps = /function public\.refuser_partie_direct[\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(sql)![1];
    expect(corps).toContain("v_uid uuid := auth.uid();");
    expect(corps).toContain("update public.games set status = 'aborted', counting = false where id = p_partie;");
    expect(corps).toContain('(case when v_uid = v_game.black_id then 2 else 4 end)');
  });
});
