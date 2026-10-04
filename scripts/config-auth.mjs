// Réglages de connexion Supabase versionnés (#414) : supabase/auth/reglages.json et supabase/auth/modeles/*.html.
// Le connecteur Supabase des agents ne touche pas ces réglages ; la CI les applique par l'API d'administration
// (PATCH /v1/projects/{ref}/config/auth), avec le secret GitHub SUPABASE_ACCESS_TOKEN.
//
//   node scripts/config-auth.mjs verifier   → contrôle local des fichiers (sans réseau)
//   node scripts/config-auth.mjs comparer   → lit la production et liste les écarts (lecture seule)
//   node scripts/config-auth.mjs appliquer  → envoie les réglages, puis relit la production pour vérifier
//
// Jamais de secret ici : mot de passe SMTP, secrets Google, Facebook et Apple restent dans Supabase. Le script refuse
// toute clé qui en ressemble à un, et n'affiche jamais une valeur lue en production, seulement les noms des clés.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../supabase/auth/', import.meta.url));
export const PROJET = 'xjvsalkvpgcjrznznxoi';
const API = `https://api.supabase.com/v1/projects/${PROJET}/config/auth`;

/** Modèles d'e-mail : fichier → clé de l'API. */
const MODELES = {
  'magic_link.html': 'mailer_templates_magic_link_content',
  'confirmation.html': 'mailer_templates_confirmation_content',
  'email_change.html': 'mailer_templates_email_change_content',
};

/** Clés interdites dans le dépôt (secrets) : refusées même si quelqu'un les ajoute au fichier. */
export const INTERDIT = /pass|secret|key|token|private/i;

/** Réglages complets à envoyer, construits depuis les fichiers du dépôt. */
export function reglages(lire = (f) => readFileSync(RACINE + f, 'utf8')) {
  const base = JSON.parse(lire('reglages.json'));
  const tout = { ...base };
  for (const [fichier, cle] of Object.entries(MODELES)) tout[cle] = lire(`modeles/${fichier}`).trim();
  return tout;
}

/** Erreurs de contenu (sans réseau). Vide : les fichiers sont bons. */
export function erreurs(r) {
  const e = [];
  for (const cle of Object.keys(r)) if (INTERDIT.test(cle)) e.push(`clé interdite (secret) : ${cle}`);
  if (r.mailer_otp_length !== 6) e.push('mailer_otp_length doit valoir 6 (LONGUEUR_CODE de src/data/account.ts)');
  for (const cle of ['mailer_subjects_magic_link', 'mailer_subjects_confirmation', 'mailer_subjects_email_change',
    ...Object.values(MODELES)]) {
    if (typeof r[cle] !== 'string' || !r[cle].includes('{{ .Token }}')) e.push(`${cle} doit contenir {{ .Token }}`);
  }
  if (!/^https:\/\//.test(r.site_url ?? '')) e.push('site_url doit être une adresse https');
  return e;
}

/** Noms des clés dont la valeur diffère en production (jamais les valeurs elles-mêmes). */
export function ecarts(voulu, prod) {
  return Object.keys(voulu).filter((k) => JSON.stringify(voulu[k]) !== JSON.stringify(prod?.[k]));
}

async function appel(methode, corps) {
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  if (!jeton) throw new Error('SUPABASE_ACCESS_TOKEN absent');
  const r = await fetch(API, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (!r.ok) throw new Error(`${methode} config/auth : HTTP ${r.status}`);
  return r.json();
}

async function principal(mode) {
  const voulu = reglages();
  const e = erreurs(voulu);
  if (e.length) { console.error(e.join('\n')); process.exit(1); }
  if (mode === 'verifier') { console.log(`Réglages valides (${Object.keys(voulu).length} clés).`); return; }

  const avant = ecarts(voulu, await appel('GET'));
  console.log(avant.length ? `Écarts avec la production : ${avant.join(', ')}` : 'Production déjà à jour.');
  if (mode === 'comparer' || !avant.length) return;

  const envoi = Object.fromEntries(avant.map((k) => [k, voulu[k]]));
  await appel('PATCH', envoi);
  const apres = ecarts(voulu, await appel('GET'));
  if (apres.length) { console.error(`Toujours différent après envoi : ${apres.join(', ')}`); process.exit(1); }
  console.log(`Appliqué et vérifié : ${avant.join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal(process.argv[2] ?? 'verifier').catch((err) => { console.error(err.message); process.exit(1); });
}
