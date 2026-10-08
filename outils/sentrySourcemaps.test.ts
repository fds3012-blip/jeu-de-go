// #474 : traces Sentry lisibles. Reproduction : sans source map, la trace de JEU-DE-GO-WEB-1 pointait sur
// `pb(assets/index-pKk86ZXF)`. La config de build doit produire et envoyer les maps quand le jeton Sentry est là.
import { describe, expect, it, vi } from 'vitest';
import { optionsPluginSentry, pluginsSentry, SENTRY_ORG, SENTRY_PROJECT, sourcemapVite, versionSentry } from './sentrySourcemaps';

describe('source maps envoyées à Sentry (#474)', () => {
  it('config de build : aucune map publiée sans jeton, maps cachées avec', async () => {
    // vite.config.ts lit process.env au chargement : rechargé avec et sans jeton.
    vi.resetModules();
    vi.stubEnv('SENTRY_AUTH_TOKEN', '');
    const sans = (await import('../vite.config')).default as { build?: { sourcemap?: unknown }; plugins?: unknown[] };
    vi.unstubAllEnvs();
    expect(sans.build?.sourcemap).toBe(false);
    expect(sourcemapVite({ SENTRY_AUTH_TOKEN: 'sntrys_test' })).toBe('hidden');
  });

  it('sans jeton : ni map ni plugin (poste de dev, CI, aperçus)', async () => {
    const charger = vi.fn();
    expect(await pluginsSentry({}, charger)).toEqual([]);
    expect(await pluginsSentry({ SENTRY_AUTH_TOKEN: '  ' }, charger)).toEqual([]);
    expect(charger).not.toHaveBeenCalled();
  });

  it('avec jeton : plugin chargé, maps envoyées puis effacées de dist/, même version que l’app', async () => {
    const plugin = { name: 'sentry-faux' };
    const sentryVitePlugin = vi.fn((o: Record<string, unknown>) => (void o, plugin));
    const env = { SENTRY_AUTH_TOKEN: ' sntrys_x ', VITE_VERCEL_GIT_COMMIT_SHA: 'abc123' };
    expect(await pluginsSentry(env, async () => ({ sentryVitePlugin }))).toEqual([plugin]);
    const o = sentryVitePlugin.mock.calls[0][0];
    expect(o).toMatchObject({
      authToken: 'sntrys_x', org: SENTRY_ORG, project: SENTRY_PROJECT, url: 'https://de.sentry.io/', telemetry: false,
      release: { name: 'abc123', inject: false },
    });
    expect((o.sourcemaps as { filesToDeleteAfterUpload: string[] }).filesToDeleteAfterUpload).toEqual(['./dist/**/*.map']);
  });

  it('version : VITE_APP_VERSION, sinon le commit Vercel', () => {
    expect(versionSentry({ VITE_APP_VERSION: '1.2', VITE_VERCEL_GIT_COMMIT_SHA: 'abc' })).toBe('1.2');
    expect(versionSentry({ VERCEL_GIT_COMMIT_SHA: 'def' })).toBe('def');
    expect(versionSentry({})).toBeUndefined();
    expect(optionsPluginSentry({ SENTRY_AUTH_TOKEN: 't' }).release).toEqual({ inject: false, create: false });
  });
});
