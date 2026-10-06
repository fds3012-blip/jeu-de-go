// Sécurité entre joueurs (#363, #373) : contrat client ↔ migration (codes, messages), garde-fous statiques de la
// migration (find_match redéfinie en entier, tâches planifiées), appels RPC, textes FR/EN. Les règles du serveur sont
// testées sur un vrai Postgres par supabase/tests/securite_signalements.test.sql ; les parcours par e2e/securite.spec.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CODES_SECURITE, EMOTES, MESSAGES, MOTIFS_JOUEUR, MOTIFS_PROBLEME, TEXTE_MAX, abonnerMessagesCoupes, bloquer, contexteTechnique, couperMessages,
  direEnPartie, estCodeMessage, lireBlocages, lireMessage, lireMessagesCoupes, messageSecurite, refusSecurite, signaler, texteNettoye,
  versionPourServeur
} from './securite';
import { CATALOGUE_SECURITE, traduireSecurite, type CleSecurite } from '../content/i18n/securite';
import { choisirLangue } from '../content/i18n/secondaires';
import type { Db } from './supabase';

const dossier = resolve(__dirname, '../../supabase/migrations');
const sansCommentaires = (s: string) => s.split('\n').filter(l => !l.trim().startsWith('--')).map(l => l.replace(/\s+--.*$/, '')).join('\n');
const MIGRATION = readFileSync(resolve(dossier, '20261005220100_securite_signalements.sql'), 'utf8');
const sql = sansCommentaires(MIGRATION);

/** Corps de `create or replace function public.<nom>(…) … $$ … $$;` dans un texte SQL. */
function fonction(texte: string, nom: string): string {
  const i = texte.indexOf(`create or replace function public.${nom}(`);
  expect(i, `${nom} absente`).toBeGreaterThanOrEqual(0);
  const debut = texte.indexOf('$$', i);
  return texte.slice(i, texte.indexOf('$$;', debut + 2) + 3);
}

/** Faux client : garde le dernier appel RPC et rend la réponse donnée. */
function fauxDb(reponse: { data?: unknown; error?: unknown } = {}) {
  const appels: { nom: string; args: Record<string, unknown> | undefined }[] = [];
  const db = { rpc: vi.fn(async (nom: string, args?: Record<string, unknown>) => { appels.push({ nom, args }); return { data: reponse.data ?? null, error: reponse.error ?? null }; }) };
  return { db: db as unknown as Db, appels };
}

afterEach(() => { choisirLangue('fr'); });

describe('migration de la sécurité (#363, #373)', () => {
  it('find_match est redéfinie en entier à partir de la forme de #436 : seule la condition de blocage est ajoutée', () => {
    const avant = fonction(sansCommentaires(readFileSync(resolve(dossier, '20261005090100_file_jamais_vide.sql'), 'utf8')), 'find_match');
    const apres = fonction(sql, 'find_match');
    expect(apres).toMatch(/and not public\.est_bloque\(v_uid, q\.user_id\)/);
    const norme = (s: string) => s.split('\n').filter(l => !/est_bloque/.test(l)).map(l => l.trim()).filter(Boolean).join('\n');
    expect(norme(apres)).toBe(norme(avant));
  });

  it('lente_apparier est redéfinie en entier à partir de la forme de #440 : seule la condition de blocage est ajoutée', () => {
    const avant = fonction(sansCommentaires(readFileSync(resolve(dossier, '20261005200100_parties_lentes.sql'), 'utf8')), 'lente_apparier');
    const apres = fonction(sql, 'lente_apparier');
    expect(apres).toMatch(/and not public\.est_bloque\(p_uid, q\.user_id\)/);
    const norme = (s: string) => s.split('\n').filter(l => !/est_bloque/.test(l)).map(l => l.trim()).filter(Boolean).join('\n');
    expect(norme(apres)).toBe(norme(avant));
    // C'est la dernière définition : aucune migration plus récente ne la remplace sans la condition.
    const fichiers = readdirSync(dossier).filter(f => f.endsWith('.sql')).sort();
    const derniere = fichiers.filter(f => /function public\.(lente_apparier|find_match)\(/.test(readFileSync(resolve(dossier, f), 'utf8'))).at(-1);
    expect(derniere).toBe('20261005220100_securite_signalements.sql');
  });

  it('trois tables nouvelles, RLS active, aucune écriture directe pour l’app', () => {
    for (const table of ['signalements', 'blocages', 'messages_partie']) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table} \\(`));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
      expect(sql).toMatch(new RegExp(`revoke insert, update, delete, truncate on public\\.${table} from authenticated`));
      expect(sql).toMatch(new RegExp(`revoke all on public\\.${table} from anon`));
    }
    // Chacun ne lit que ses signalements et ses blocages.
    expect(sql).toMatch(/on public\.signalements\s+for select to authenticated\s+using \(auteur_id = \(select auth\.uid\(\)\)\)/);
    expect(sql).toMatch(/on public\.blocages\s+for select to authenticated\s+using \(bloqueur_id = \(select auth\.uid\(\)\)\)/);
    // La vue de l'équipe est en security_invoker, et fermée à l'app.
    expect(sql).toMatch(/create view public\.signalements_a_revoir with \(security_invoker = true\)/);
    expect(sql).toMatch(/revoke all on public\.signalements_a_revoir from public, anon, authenticated/);
  });

  it('chaque fonction est security definer à search_path vide (lente_apparier : invoker comme dans #440, interne)', () => {
    const defs = [...sql.matchAll(/create or replace function public\.(\w+)\([\s\S]*?\nas \$\$/g)];
    expect(defs.length).toBeGreaterThanOrEqual(12);
    for (const d of defs) expect(d[0], d[1]).toMatch(d[1] === 'lente_apparier' ? /security invoker set search_path = ''/ : /security definer set search_path = ''/);
  });

  it('les fonctions internes sont fermées à l’app ; celles de l’app à anon', () => {
    for (const nom of ['est_bloque(uuid, uuid)', 'defis_blocage()', 'friendships_blocage()', 'purger_securite()', 'direct_clore_abandonnees()']) {
      expect(sql).toContain(`revoke execute on function public.${nom} from public, anon, authenticated, service_role;`);
    }
    expect(sql).toMatch(/revoke execute on function public\.signaler\([^)]*\) from public, anon;/);
    expect(sql).toMatch(/revoke execute on function public\.dire_en_partie\(uuid, text\) from public, anon;/);
  });

  it('aucune suppression de données hors du corps des fonctions ; tâches pg_cron nommées', () => {
    const horsFonctions = sql.replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, ' ');
    expect(horsFonctions).not.toMatch(/\bdelete\s+from\b|(^|;)\s*truncate\b|\bdrop\s+(table|column|schema)\b/im);
    expect(MIGRATION).toMatch(/cron\.schedule\('clore-parties-direct-abandonnees', '\* \* \* \* \*', 'select public\.direct_clore_abandonnees\(\)'\)/);
    expect(MIGRATION).toMatch(/cron\.schedule\('purger-securite', '37 3 \* \* \*', 'select public\.purger_securite\(\)'\)/);
    // La tâche passe par la règle d'absence de #360 : jamais de cote écrite à la main.
    const clore = fonction(sql, 'direct_clore_abandonnees');
    expect(clore).toContain('public.direct_constater(');
    expect(clore).not.toMatch(/apply_game_rating|rating_history|update public\.games/);
  });

  it('les codes des messages sont les mêmes au serveur et au client, sans texte libre', () => {
    const liste = /code text not null check \(code in \(([^)]*)\)\)/.exec(sql)?.[1] ?? '';
    const codes = [...liste.matchAll(/'(\w+)'/g)].map(m => m[1]);
    expect(codes).toEqual([...MESSAGES, ...EMOTES]);
    expect(MESSAGES).toHaveLength(6);
    expect(EMOTES).toHaveLength(4);
    const table = /create table public\.messages_partie \([\s\S]*?\n\);/.exec(sql)?.[0] ?? '';
    expect(table).toContain('code text not null');
    expect(table).not.toMatch(/\btexte\b|\bmessage text\b/);
  });

  it('les motifs du client sont acceptés par le serveur', () => {
    const joueur = /p_motif not in \(('triche'[^)]*)\)/.exec(fonction(sql, 'signaler'))?.[1] ?? '';
    expect([...joueur.matchAll(/'(\w+)'/g)].map(m => m[1]).sort()).toEqual([...MOTIFS_JOUEUR].sort());
    const probleme = /p_motif not in \(('reponse_fausse'[^)]*)\)/.exec(fonction(sql, 'signaler'))?.[1] ?? '';
    expect([...probleme.matchAll(/'(\w+)'/g)].map(m => m[1]).sort()).toEqual([...MOTIFS_PROBLEME].sort());
    expect(sql).toContain(`char_length(texte) between 1 and ${TEXTE_MAX}`);
  });

  it('chaque code d’erreur de la migration a son message clair', () => {
    const codes = new Set([...sql.matchAll(/errcode = '(JG[A-Z]\d\d)'/g)].map(m => m[1]));
    for (const c of codes) expect(Object.keys(CODES_SECURITE), c).toContain(c);
    for (const refus of new Set(Object.values(CODES_SECURITE))) {
      expect(CATALOGUE_SECURITE.fr[`erreur.${refus}` as CleSecurite], refus).toBeTruthy();
    }
  });
});

describe('appels au serveur', () => {
  it('signaler un joueur depuis une partie : la partie, jamais d’identifiant de joueur ; texte nettoyé', async () => {
    const { db, appels } = fauxDb();
    const r = await signaler(db, { type: 'joueur', motif: 'triche', texte: `  ${'a'.repeat(600)}  `, partie: 'p1' }, { version: 'abc1234', ecran: 'partie' });
    expect(r).toEqual({ ok: true, value: true });
    const a = appels[0];
    expect(a.nom).toBe('signaler');
    expect(a.args).toMatchObject({ p_type: 'joueur', p_motif: 'triche', p_partie: 'p1', p_version: 'abc1234' });
    expect(a.args?.p_pseudo).toBeUndefined();
    expect(String(a.args?.p_texte)).toHaveLength(TEXTE_MAX);
    expect(JSON.stringify(a.args?.p_contexte)).not.toMatch(/@/);
  });

  it('signaler un problème : son identifiant arrive au serveur', async () => {
    const { db, appels } = fauxDb();
    await signaler(db, { type: 'probleme', motif: 'reponse_fausse', probleme: 'ko-3' }, { version: 'dev', ecran: 'probleme' });
    expect(appels[0].args).toMatchObject({ p_type: 'probleme', p_motif: 'reponse_fausse', p_probleme: 'ko-3' });
    expect(appels[0].args?.p_texte).toBeUndefined();
  });

  it('« Nous écrire » : pas de motif ; version mal formée retirée', async () => {
    const { db, appels } = fauxDb();
    await signaler(db, { type: 'bug', texte: 'Le plateau clignote' }, { version: 'v1 ; drop', ecran: 'profil' });
    expect(appels[0].args).toMatchObject({ p_type: 'bug', p_texte: 'Le plateau clignote' });
    expect(appels[0].args?.p_motif).toBeUndefined();
    expect(appels[0].args?.p_version).toBeUndefined();
  });

  it('refus du serveur : message clair, jamais le texte brut', async () => {
    const { db } = fauxDb({ error: { code: 'JGS01', message: 'Tu as déjà envoyé 10 signalements aujourd’hui' } });
    expect(await signaler(db, { type: 'bug', texte: 'x' }, { ecran: 'profil' })).toEqual({ ok: false, error: 'Tu as déjà envoyé 10 messages aujourd’hui. Réessaie demain.' });
    const { db: db2 } = fauxDb({ error: { code: 'XX000', message: 'détail interne' } });
    expect(await direEnPartie(db2, 'p', 'merci')).toEqual({ ok: false, error: 'Le serveur ne répond pas. Réessaie dans un instant.' });
    expect(refusSecurite({ code: 'JGB01' })).toBe('indisponible');
    expect(refusSecurite({ code: 'JGM01' })).toBe('limitePartie');
    expect(refusSecurite(null)).toBeNull();
    choisirLangue('en');
    expect(messageSecurite({ code: 'JGM03' })).toBe('Easy: one message every 3 seconds.');
  });

  it('bloquer : par partie ou par pseudo, mêmes noms d’arguments que la migration', async () => {
    const { db, appels } = fauxDb();
    await bloquer(db, { partie: 'p1' });
    await bloquer(db, { pseudo: 'Lea' });
    expect(appels.map(a => a.args)).toEqual([{ p_pseudo: undefined, p_partie: 'p1' }, { p_pseudo: 'Lea', p_partie: undefined }]);
  });

  it('dire : le code seulement', async () => {
    const { db, appels } = fauxDb();
    await direEnPartie(db, 'p1', 'bien_joue');
    expect(appels[0]).toEqual({ nom: 'dire_en_partie', args: { p_partie: 'p1', p_code: 'bien_joue' } });
  });
});

describe('lectures et utilitaires', () => {
  it('message poussé par le temps réel : seulement un code connu', () => {
    expect(lireMessage({ id: 3, auteur_id: 'u', code: 'merci', partie_id: 'p' })).toEqual({ id: 3, auteur: 'u', code: 'merci' });
    expect(lireMessage({ id: 3, auteur_id: 'u', code: 'Tu es nul' })).toBeNull();
    expect(lireMessage({ id: 'x', auteur_id: 'u', code: 'merci' })).toBeNull();
    expect(estCodeMessage('mochi_fier')).toBe(true);
    expect(estCodeMessage('texte')).toBe(false);
  });

  it('blocages lus par pseudo ; lignes mal formées ignorées', () => {
    expect(lireBlocages([{ pseudo: 'Lea', depuis: '2026-10-05' }, { id: 'x' }, null])).toEqual([{ pseudo: 'Lea', depuis: '2026-10-05' }]);
    expect(lireBlocages(null)).toEqual([]);
  });

  it('texte et version nettoyés ; contexte technique sans donnée personnelle', () => {
    expect(texteNettoye('   ')).toBeNull();
    expect(texteNettoye(' ok ')).toBe('ok');
    expect(versionPourServeur('a'.repeat(50))).toBe('a'.repeat(40));
    expect(versionPourServeur('')).toBeNull();
    expect(contexteTechnique('profil')).toMatchObject({ ecran: 'profil' });
  });

  it('réglage « Messages de l’adversaire » : partagé, prévient les écrans', () => {
    const f = vi.fn();
    const stop = abonnerMessagesCoupes(f);
    couperMessages(true);
    expect(lireMessagesCoupes()).toBe(true);
    couperMessages(false);
    expect(lireMessagesCoupes()).toBe(false);
    expect(f).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('textes (FR et EN)', () => {
  it('mêmes clés, aucune vide, variables identiques', () => {
    const fr = CATALOGUE_SECURITE.fr, en = CATALOGUE_SECURITE.en;
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const k of Object.keys(fr) as CleSecurite[]) {
      expect(en[k], k).toBeTruthy();
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      expect(vars(en[k]), k).toEqual(vars(fr[k]));
    }
  });

  it('tutoiement, phrases courtes, chaque message et chaque motif traduit', () => {
    for (const [k, v] of Object.entries(CATALOGUE_SECURITE.fr)) {
      expect(v, k).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
      expect(v.length, k).toBeLessThanOrEqual(110);
    }
    for (const c of [...MESSAGES, ...EMOTES]) expect(traduireSecurite('en', `msg.${c}`)).not.toBe(traduireSecurite('fr', `msg.${c}`));
    for (const m of [...MOTIFS_JOUEUR, ...MOTIFS_PROBLEME]) expect(CATALOGUE_SECURITE.fr[`signaler.motif.${m}` as CleSecurite], m).toBeTruthy();
    expect(traduireSecurite('fr', 'signaler.merci')).toBe('Merci, on regarde.');
  });
});
