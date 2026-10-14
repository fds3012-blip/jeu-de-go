// En-têtes de sécurité (#531, chantier C7). Deux politiques CSP s'appliquent ensemble ; un contenu doit passer les deux :
//
// 1. L'en-tête `Content-Security-Policy` de vercel.json (règle `/(.*)`) : sources permises pour toute l'app, pages,
//    Workers (KataGo) et service worker compris : Supabase (https et wss), PostHog, Sentry, KataGo (repli sur
//    raw.githubusercontent.com), parties OGS, Turnstile ; `frame-ancestors 'none'`, `object-src 'none'`. Il permet
//    les scripts en ligne (`'unsafe-inline'`) : vercel.json est fixe, il ne peut pas connaître leurs empreintes.
// 2. Une balise `<meta http-equiv="Content-Security-Policy">` en tête de chaque page HTML de dist/, écrite au build
//    par ce plugin : `script-src` avec l'empreinte SHA-256 de chaque script en ligne de CETTE page. Les deux politiques
//    réunies : un script en ligne ne s'exécute que si son empreinte est connue. Les empreintes suivent le code à
//    chaque build (texte de l'ouverture, préchargement de l'anglais, pages de référencement) : rien à tenir à jour.
//
// `vite preview` applique les en-têtes de vercel.json à toutes les réponses : les tests de bout en bout tournent sous
// la même politique que la production (e2e/csp.spec.ts guette toute violation). Les hôtes simulés de ces tests
// (Supabase, PostHog) sont ajoutés à `connect-src` en préversion seulement, jamais dans vercel.json.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export interface EnTete { key: string; value: string }
interface RegleEntetes { source: string; headers: EnTete[] }

/** Règle de vercel.json qui s'applique à toutes les adresses. */
export const SOURCE_GLOBALE = '/(.*)';

/** Sources des scripts, communes à l'en-tête et à la balise meta (Turnstile, et WebAssembly pour TensorFlow.js). */
export const SCRIPTS_PERMIS = ["'self'", "'wasm-unsafe-eval'", 'https://challenges.cloudflare.com'];

/** Hôtes simulés des tests de bout en bout (e2e/fauxSupabase.ts, e2e/*.spec.ts), permis en préversion seulement. */
export const HOTES_E2E = ['https://supabase.e2e.test', 'wss://supabase.e2e.test', 'https://posthog-e2e.test'];

/** En-têtes de la règle globale de vercel.json. */
export function entetesGlobaux(vercel: { headers?: RegleEntetes[] }): EnTete[] {
  return vercel.headers?.find(r => r.source === SOURCE_GLOBALE)?.headers ?? [];
}

/** Directives d'une politique CSP : `{ 'connect-src': ['self', …] }`. */
export function directives(politique: string): Record<string, string[]> {
  const d: Record<string, string[]> = {};
  for (const morceau of politique.split(';')) {
    const [nom, ...valeurs] = morceau.trim().split(/\s+/);
    if (nom) d[nom.toLowerCase()] = valeurs;
  }
  return d;
}

/** Politique recomposée depuis ses directives. */
export function politique(d: Record<string, string[]>): string {
  return Object.entries(d).map(([nom, v]) => [nom, ...v].join(' ')).join('; ');
}

/** En-têtes appliqués par `vite preview` : ceux de vercel.json, `connect-src` élargi aux hôtes simulés des tests. */
export function entetesPreversion(vercel: { headers?: RegleEntetes[] }): EnTete[] {
  return entetesGlobaux(vercel).map(e => {
    if (!/^content-security-policy(-report-only)?$/i.test(e.key)) return e;
    const d = directives(e.value);
    d['connect-src'] = [...(d['connect-src'] ?? []), ...HOTES_E2E];
    return { key: e.key, value: politique(d) };
  });
}

/** Scripts en ligne exécutables d'une page (ni `src`, ni données JSON). */
export function scriptsEnLigne(html: string): string[] {
  const corps: string[] = [];
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attributs = m[1] ?? '';
    if (/\bsrc\s*=/i.test(attributs)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributs)?.[1]?.toLowerCase();
    if (type && type !== 'module' && type !== 'text/javascript' && type !== 'application/javascript') continue;
    corps.push(m[2]);
  }
  return corps;
}

export const empreinte = (code: string) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;

const META = /<meta http-equiv="Content-Security-Policy"[^>]*>\s*/gi;

/** La page avec sa balise meta CSP (empreintes de ses scripts en ligne), juste après `<meta charset>`. */
export function avecMetaCsp(html: string): string {
  const sans = html.replace(META, '');
  const empreintes = [...new Set(scriptsEnLigne(sans).map(empreinte))];
  const balise = `<meta http-equiv="Content-Security-Policy" content="${politique({ 'script-src': [...SCRIPTS_PERMIS, ...empreintes] })}" />`;
  const charset = /<meta charset="[^"]*"\s*\/?>/i.exec(sans);
  if (!charset) throw new Error('Page sans <meta charset> : la balise CSP doit précéder tout script');
  const fin = charset.index + charset[0].length;
  return `${sans.slice(0, fin)}\n    ${balise}${sans.slice(fin)}`;
}

function pagesHtml(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(e => {
    const chemin = join(dossier, e.name);
    return e.isDirectory() ? pagesHtml(chemin) : e.name.endsWith('.html') ? [chemin] : [];
  });
}

/**
 * Plugin Vite : balise meta CSP dans chaque page de dist/ (après les plugins qui écrivent des pages : aperçus,
 * référencement) ; et en-têtes de vercel.json en préversion.
 */
export function entetesSecurite(): Plugin {
  let dossier = 'dist';
  return {
    name: 'go-entetes-securite',
    configResolved(c) { dossier = join(c.root, c.build.outDir); },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        for (const page of pagesHtml(dossier)) writeFileSync(page, avecMetaCsp(readFileSync(page, 'utf8')));
      },
    },
    configurePreviewServer(server) {
      const vercel = JSON.parse(readFileSync(join(server.config.root, 'vercel.json'), 'utf8')) as { headers?: RegleEntetes[] };
      const entetes = entetesPreversion(vercel);
      server.middlewares.use((_req, res, next) => {
        for (const e of entetes) res.setHeader(e.key, e.value);
        next();
      });
    },
  };
}
