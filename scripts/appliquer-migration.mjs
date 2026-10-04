// Appliquer une migration Supabase depuis GitHub Actions (#421).
// Le connecteur Supabase des agents expire dès qu'une migration contient un `delete` ou un `drop function` : la CI
// l'applique à sa place par l'API d'administration (POST /v1/projects/{ref}/database/query), secret SUPABASE_ACCESS_TOKEN.
//
//   node scripts/appliquer-migration.mjs verifier  <fichier.sql>  → garde-fous seulement (sans réseau)
//   node scripts/appliquer-migration.mjs appliquer <fichier.sql>  → garde-fous, puis application en une transaction
//
// Règle de la charte : aucune suppression de données en production. Le script refuse donc les ordres qui en effacent
// (truncate, drop table/schema/column, désactivation du RLS). Les `delete` restent permis dans le corps des fonctions
// (purge d'une file d'attente, par exemple) : ils sont signalés dans le journal. Le SQL n'est jamais affiché.
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJET = 'xjvsalkvpgcjrznznxoi';
const API = `https://api.supabase.com/v1/projects/${PROJET}/database/query`;
const DOSSIER = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');

/** Ordres refusés : ils effacent des données ou retirent une protection. */
export const INTERDITS = [
  // Ordre `truncate` seulement (pas « revoke … truncate », qui retire un droit).
  [/(^|;|\$\$)\s*truncate\b/im, 'truncate'],
  [/\bdrop\s+table\b/i, 'drop table'],
  [/\bdrop\s+schema\b/i, 'drop schema'],
  [/\bdrop\s+column\b/i, 'drop column'],
  [/\bdrop\s+database\b/i, 'drop database'],
  [/\bdisable\s+row\s+level\s+security\b/i, 'désactivation du RLS'],
  [/\bno\s+force\s+row\s+level\s+security\b/i, 'désactivation du RLS'],
];

/** Retire les commentaires SQL, pour ne pas refuser un mot cité dans un commentaire. */
export function sansCommentaires(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** Nom de fichier → version et nom de la migration, ou null s'il ne suit pas la convention. */
export function identite(fichier) {
  const m = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(basename(fichier));
  return m ? { version: m[1], nom: m[2] } : null;
}

/** Contrôle sans réseau : erreurs (bloquantes) et avertissements. */
export function controler(fichier, sql) {
  const erreurs = [];
  const avertissements = [];
  if (!identite(fichier)) erreurs.push('nom de fichier attendu : AAAAMMJJHHMMSS_nom.sql');
  const code = sansCommentaires(sql);
  for (const [motif, nom] of INTERDITS) if (motif.test(code)) erreurs.push(`ordre interdit (suppression de données) : ${nom}`);
  // Hors du corps des fonctions ($$ … $$), un `delete` efface des données tout de suite : refusé.
  const horsFonctions = code.replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, ' ');
  if (/\bdelete\s+from\b/i.test(horsFonctions)) erreurs.push('ordre interdit (suppression de données) : delete hors fonction');
  const deletes = (code.match(/\bdelete\s+from\b/gi) ?? []).length;
  if (deletes) avertissements.push(`${deletes} « delete from » dans des fonctions (à relire)`);
  if (/\bcreate\s+table\b/i.test(code) && !/\benable\s+row\s+level\s+security\b/i.test(code)) {
    erreurs.push('nouvelle table sans « enable row level security »');
  }
  if (!code.trim()) erreurs.push('fichier vide');
  return { erreurs, avertissements };
}

/** Requête complète : la migration et sa trace, dans une seule transaction. */
export function requete(sql, { version, nom }) {
  return `begin;\n${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${nom}');\ncommit;`;
}

async function appel(query) {
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  if (!jeton) throw new Error('SUPABASE_ACCESS_TOKEN absent');
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const texte = await r.text();
  // En cas d'échec, seul le message d'erreur de Postgres est montré (jamais la requête envoyée).
  if (!r.ok) throw new Error(`HTTP ${r.status} : ${texte.slice(0, 500)}`);
  return texte ? JSON.parse(texte) : [];
}

async function principal(mode, arg) {
  if (!arg) throw new Error('Donne le nom du fichier de migration');
  const fichier = resolve(DOSSIER, basename(arg));
  const sql = readFileSync(fichier, 'utf8');
  const { erreurs, avertissements } = controler(fichier, sql);
  for (const a of avertissements) console.log(`::warning::${a}`);
  if (erreurs.length) { console.error(erreurs.join('\n')); process.exit(1); }
  const id = identite(fichier);
  console.log(`Migration ${id.version} ${id.nom} : garde-fous OK.`);
  if (mode === 'verifier') return;

  const deja = await appel(`select 1 from supabase_migrations.schema_migrations where version = '${id.version}' or name = '${id.nom}'`);
  if (deja.length) { console.log('Déjà appliquée : rien à faire.'); return; }
  await appel(requete(sql, id));
  const apres = await appel(`select 1 from supabase_migrations.schema_migrations where version = '${id.version}'`);
  if (!apres.length) { console.error('La trace de la migration est absente après application.'); process.exit(1); }
  console.log(`Appliquée et notée : ${id.version} ${id.nom}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal(process.argv[2] ?? 'verifier', process.argv[3]).catch((err) => { console.error(err.message); process.exit(1); });
}
