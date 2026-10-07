import { existsSync } from 'node:fs';
import { chromium, defineConfig, devices } from '@playwright/test';

// PW_PORT permet de lancer plusieurs suites e2e en parallèle sur la même machine.
const PORT = Number(process.env.PW_PORT ?? 4173);

// Chromium à utiliser :
// - PW_CHROMIUM_PATH s'il est défini ;
// - sinon, hors CI, si le Chromium attendu par cette version de Playwright est absent
//   mais qu'un Chromium préinstallé existe (conteneurs des agents), on prend celui-là ;
// - en CI : le navigateur installé par `npx playwright install --with-deps chromium`.
const PREINSTALLED = '/opt/pw-browsers/chromium';
function pickExecutable(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  if (process.env.CI) return undefined;
  if (!existsSync(chromium.executablePath()) && existsSync(PREINSTALLED)) return PREINSTALLED;
  return undefined;
}
const executablePath = pickExecutable();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // En CI, la suite tourne en 4 lots (`--shard`, #467) : chaque lot écrit un rapport « blob », que le job
  // « Playwright (mobile) » fusionne (`playwright merge-reports --reporter=github,html`). `dot` garde un journal court.
  reporter: process.env.CI ? [['dot'], ['blob']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    locale: 'fr-FR',
    // Fenêtre de consentement (issue #50) : déjà répondue pour les parcours qui ne la testent pas.
    // e2e/confidentialite.spec.ts repart d'un stockage vide pour la tester.
    storageState: { cookies: [], origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  },
  projects: [
    {
      name: 'iphone',
      use: {
        // Viewport iPhone (390 x 844) mais moteur Chromium : seul navigateur installé en CI.
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  webServer: {
    // VITE_E2E=1 active les paramètres de test (ex. `?komi=`), absents des builds de production.
    command: `VITE_E2E=1 npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
