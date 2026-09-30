// Contrat client ↔ serveur (recette du 30/09, après #344) : le défi par lien marchait en e2e (Supabase simulé) mais pas en
// production, parce que la fonction serveur appelée n'y était pas. Ce test lit le code du client et vérifie que tout ce
// qu'il appelle existe bien côté serveur dans le dépôt : fonctions SQL (RPC) avec les mêmes noms d'arguments et le droit
// d'exécution, fonctions serveur et leurs actions, tables avec RLS et une politique pour chaque opération.
// Il vérifie aussi que les e2e ne simulent rien qui n'existe pas dans le dépôt.
// Ce que ce test ne voit pas : ce qui est DÉPLOYÉ (voir docs/qa/recette-2026-09-30.md, « Vérifier le déploiement »).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseActionRequest } from '../go/server';
import { parseDefiCoupRequest } from '../go/defi-action';

const RACINE = resolve(__dirname, '../..');

function fichiers(dossier: string, filtre: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin, filtre));
    else if (filtre(chemin)) out.push(chemin);
  }
  return out;
}

const lire = (f: string) => readFileSync(f, 'utf8');
const sansCommentairesSql = (s: string) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Code du client : src/, sans les tests.
const CLIENT = fichiers(join(RACINE, 'src'), f => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith('database.types.ts'));
const SQL = fichiers(join(RACINE, 'supabase/migrations'), f => f.endsWith('.sql')).sort().map(f => sansCommentairesSql(lire(f))).join('\n');
const E2E = fichiers(join(RACINE, 'e2e'), f => f.endsWith('.ts'));
const FONCTIONS = readdirSync(join(RACINE, 'supabase/functions')).filter(d => statSync(join(RACINE, 'supabase/functions', d)).isDirectory());

interface Appel { fichier: string; nom: string; args: string[] }

/** `db.rpc('nom', { a, b: x })` : nom et clés de l'objet d'arguments. */
function appelsRpc(): Appel[] {
  const out: Appel[] = [];
  for (const f of CLIENT) {
    for (const m of lire(f).matchAll(/\.rpc\(\s*'(\w+)'\s*(?:,\s*\{([^}]*)\})?/g)) {
      const args = (m[2] ?? '').split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);
      out.push({ fichier: relative(RACINE, f), nom: m[1], args });
    }
  }
  return out;
}

/** Arguments de la DERNIÈRE définition de `public.nom` dans les migrations (celle qui est en place). */
function signatureSql(nom: string): string[] | null {
  const defs = [...SQL.matchAll(new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${nom}\\s*\\(([^)]*)\\)`, 'gi'))];
  if (!defs.length) return null;
  return defs.at(-1)![1].split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
}

/** `db.from('table')` suivi des opérations de la même chaîne (select, insert, update, upsert, delete). */
function accesTables(): { fichier: string; table: string; ops: Set<string> }[] {
  const out: { fichier: string; table: string; ops: Set<string> }[] = [];
  for (const f of CLIENT) {
    const src = lire(f);
    for (const m of src.matchAll(/\bdb\.from\(\s*'(\w+)'\s*\)/g)) {
      const suite = src.slice(m.index! + m[0].length).split(/;|\bdb\.from\(/)[0];
      const ops = new Set([...suite.matchAll(/\.(select|insert|update|upsert|delete)\(/g)].map(o => o[1]));
      out.push({ fichier: relative(RACINE, f), table: m[1], ops });
    }
  }
  return out;
}

/** Opérations couvertes par au moins une politique PERMISSIVE de la table (une politique restrictive seule n'ouvre rien). */
function operationsPermises(table: string): Set<string> {
  const ops = new Set<string>();
  for (const m of SQL.matchAll(/create\s+policy\s+"[^"]*"\s+on\s+public\.(\w+)([^;]*);/gi)) {
    if (m[1] !== table || /\bas\s+restrictive\b/i.test(m[2])) continue;
    const pour = /\bfor\s+(select|insert|update|delete|all)\b/i.exec(m[2])?.[1].toLowerCase() ?? 'all';
    if (pour === 'all') ['select', 'insert', 'update', 'delete'].forEach(o => ops.add(o));
    else ops.add(pour);
  }
  return ops;
}

describe('contrat client ↔ serveur', () => {
  const rpc = appelsRpc();

  it('le client appelle bien des RPC (le relevé fonctionne)', () => {
    expect(rpc.map(a => a.nom)).toEqual(expect.arrayContaining(['creer_defi', 'rejoindre_defi', 'record_puzzle_attempt']));
  });

  it.each(rpc.map(a => [a.nom, a] as const))('RPC %s : définie dans une migration, mêmes noms d’arguments, exécutable par authenticated', (nom, appel) => {
    const params = signatureSql(nom);
    expect(params, `${appel.fichier} appelle ${nom}, absente de supabase/migrations`).not.toBeNull();
    // PostgREST retrouve la fonction par les NOMS des arguments : un nom différent donne une erreur 404 en production.
    expect([...appel.args].sort(), `${appel.fichier} : arguments de ${nom}`).toEqual([...params!].sort());
    const droit = new RegExp(`grant\\s+execute\\s+on\\s+function[^;]*public\\.${nom}\\s*\\([^;]*to\\s+[^;]*\\bauthenticated\\b`, 'i');
    expect(SQL, `${nom} : pas de « grant execute … to authenticated »`).toMatch(droit);
  });

  const invocations = CLIENT.flatMap(f => [...lire(f).matchAll(/functions\.invoke(?:<[^>]*>)?\(\s*'([\w-]+)'/g)].map(m => ({ fichier: relative(RACINE, f), slug: m[1], src: lire(f) })));

  it('le client invoque bien des fonctions serveur (le relevé fonctionne)', () => {
    expect(invocations.map(i => i.slug)).toContain('game-action');
  });

  it.each(invocations.map(i => [i.slug, i.fichier, i] as const))('fonction serveur %s (appelée par %s) : présente dans supabase/functions', (slug, fichier) => {
    expect(FONCTIONS, `${fichier} invoque ${slug}`).toContain(slug);
  });

  it('game-action : chaque action envoyée par le client est acceptée par la fonction serveur', () => {
    const actions = new Set<string>();
    for (const i of invocations.filter(x => x.slug === 'game-action')) for (const m of i.src.matchAll(/action:\s*'(\w+)'/g)) actions.add(m[1]);
    expect([...actions].sort()).toEqual(['accept', 'defi_coup', 'move', 'propose_dead', 'resume']);
    const id = '11111111-1111-4111-8111-111111111111';
    for (const action of actions) {
      const corps = { action, gameId: id, game_id: id, move: 'aa', dead: '' };
      expect(parseActionRequest(corps) ?? parseDefiCoupRequest(corps), `action ${action} refusée par le serveur`).not.toBeNull();
    }
    // La fonction Deno aiguille bien `defi_coup` avant les autres actions.
    expect(lire(join(RACINE, 'supabase/functions/game-action/index.ts'))).toMatch(/action\s*===\s*'defi_coup'/);
  });

  it('les RPC appelées par les fonctions serveur (clé service) sont définies dans les migrations', () => {
    const src = fichiers(join(RACINE, 'supabase/functions'), f => f.endsWith('.ts')).map(lire).join('\n');
    const noms = [...src.matchAll(/\.rpc\(\s*'(\w+)'/g)].map(m => m[1]);
    expect(noms).toEqual(expect.arrayContaining(['jouer_coup_defi', 'finish_game_by_score']));
    for (const nom of noms) expect(signatureSql(nom), `supabase/functions appelle ${nom}, absente des migrations`).not.toBeNull();
  });

  const tables = accesTables();

  it.each(tables.map(t => [t.table, [...t.ops].join('+') || 'lecture', t] as const))('table %s (%s) : créée, RLS activée, politique pour chaque opération', (table, _ops, acces) => {
    expect(SQL, `table ${table} absente des migrations`).toMatch(new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\b`, 'i'));
    expect(SQL, `RLS non activée sur ${table}`).toMatch(new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i'));
    const permis = operationsPermises(table);
    const besoin = new Set([...acces.ops].flatMap(o => (o === 'upsert' ? ['insert', 'update'] : [o])));
    if (!besoin.size) besoin.add('select');
    for (const op of besoin) expect(permis.has(op), `${acces.fichier} : ${op} sur ${table} sans politique permissive`).toBe(true);
  });

  it('temps réel : chaque table écoutée par le client est publiée (supabase_realtime) et lisible par RLS', () => {
    const ecoutees = new Set(CLIENT.flatMap(f => [...lire(f).matchAll(/postgres_changes'[^)]*?table:\s*'(\w+)'/g)].map(m => m[1])));
    expect([...ecoutees]).toEqual(expect.arrayContaining(['games', 'defis']));
    for (const table of ecoutees) {
      expect(SQL, `${table} écoutée mais absente de la publication supabase_realtime`).toMatch(new RegExp(`alter\\s+publication\\s+supabase_realtime\\s+add\\s+table\\s+[^;]*public\\.${table}\\b`, 'i'));
      expect(operationsPermises(table).has('select'), `${table} écoutée sans politique de lecture`).toBe(true);
    }
  });

  it('les e2e ne simulent que des RPC et des fonctions serveur qui existent dans le dépôt', () => {
    for (const f of E2E) {
      const src = lire(f);
      for (const m of src.matchAll(/\/rest\/v1\/rpc\/(\w+)/g)) expect(signatureSql(m[1]), `${relative(RACINE, f)} simule ${m[1]}`).not.toBeNull();
      for (const m of src.matchAll(/\/functions\/v1\/([\w-]+)/g)) expect(FONCTIONS, `${relative(RACINE, f)} simule ${m[1]}`).toContain(m[1]);
    }
  });
});
