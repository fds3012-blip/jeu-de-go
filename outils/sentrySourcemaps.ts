/**
 * Source maps envoyées à Sentry (#474).
 *
 * Constat du 08/10 : la trace de JEU-DE-GO-WEB-1 pointait sur `pb(assets/index-pKk86ZXF)`, du code minifié illisible.
 * Le build ne produisait aucune source map et rien ne les envoyait.
 *
 * Maintenant, seulement quand `SENTRY_AUTH_TOKEN` est défini (variable secrète de Vercel, jamais dans le dépôt) :
 * - Vite produit des source maps « cachées » (`hidden` : aucun commentaire `sourceMappingURL` dans le JS servi) ;
 * - @sentry/vite-plugin relie chaque fichier JS à sa map par un identifiant (debug ID), les envoie à Sentry,
 *   puis les efface de `dist/` : elles ne sont jamais publiées sur le site.
 * Sans jeton (poste de dev, CI, aperçus sans secret) : rien ne change, pas de map, plugin non chargé.
 *
 * L'organisation et le projet ne sont pas secrets (ils figurent dans le DSN public) ; ils restent modifiables par
 * `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_URL`.
 */
import type { PluginOption } from 'vite';

export const SENTRY_ORG = '615e4f5bfb8c';
export const SENTRY_PROJECT = 'jeu-de-go-web';
/** Région de l'organisation (Europe). */
export const SENTRY_URL = 'https://de.sentry.io/';

type Env = Record<string, string | undefined>;

/** Vrai si le build doit produire et envoyer les source maps. */
export function envoiSourcemaps(env: Env): boolean {
  return !!env.SENTRY_AUTH_TOKEN?.trim();
}

/** Version envoyée avec les maps : la même que celle que l'app donne à Sentry (src/data/analytics.ts). */
export function versionSentry(env: Env): string | undefined {
  return env.VITE_APP_VERSION?.trim() || env.VITE_VERCEL_GIT_COMMIT_SHA?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || undefined;
}

/** Réglages passés à `sentryVitePlugin`. */
export function optionsPluginSentry(env: Env): Record<string, unknown> {
  const version = versionSentry(env);
  return {
    authToken: env.SENTRY_AUTH_TOKEN!.trim(),
    org: env.SENTRY_ORG?.trim() || SENTRY_ORG,
    project: env.SENTRY_PROJECT?.trim() || SENTRY_PROJECT,
    url: env.SENTRY_URL?.trim() || SENTRY_URL,
    // Pas de statistiques d'usage du plugin envoyées à Sentry.
    telemetry: false,
    // L'app donne déjà sa version à Sentry.init : le plugin ne l'injecte pas, il la crée seulement côté Sentry.
    release: version ? { name: version, inject: false } : { inject: false, create: false },
    sourcemaps: {
      assets: ['./dist/**/*.js', './dist/**/*.js.map'],
      filesToDeleteAfterUpload: ['./dist/**/*.map'],
    },
  };
}

/** Option `build.sourcemap` de Vite. */
export function sourcemapVite(env: Env): 'hidden' | false {
  return envoiSourcemaps(env) ? 'hidden' : false;
}

/** Charge le plugin : par défaut, le vrai (installé en devDependency). Injecté dans les tests. */
export type ChargeurPlugin = () => Promise<{ sentryVitePlugin: (o: Record<string, unknown>) => PluginOption }>;
// Spécificateur en variable : le module n'est résolu que s'il est demandé (pas de jeton, pas de chargement).
const NOM_PLUGIN = '@sentry/vite-plugin';
const chargerPlugin: ChargeurPlugin = () => import(/* @vite-ignore */ NOM_PLUGIN);

/** Plugins Vite à ajouter : aucun sans jeton. À placer en dernier (après le build des fichiers). */
export async function pluginsSentry(env: Env, charger: ChargeurPlugin = chargerPlugin): Promise<PluginOption[]> {
  if (!envoiSourcemaps(env)) return [];
  const { sentryVitePlugin } = await charger();
  return [sentryVitePlugin(optionsPluginSentry(env))];
}
