import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { precacheSw } from './outils/pwa';

export default defineConfig({
  // precacheSw : liste des fichiers du service worker, injectée dans dist/sw.js (outils/pwa.ts).
  plugins: [react(), precacheSw()],
  build: {
    rollupOptions: {
      output: {
        // Bibliothèques à part : leur empreinte ne change pas quand le code de l'app change,
        // un joueur qui revient après un déploiement ne les retélécharge pas.
        // Budget de taille vérifié par scripts/budget-bundle.mjs (CI).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/(@supabase|iceberg-js)\//.test(id)) return 'supabase';
          return undefined;
        },
      },
    },
  },
  // Workers en modules ES : le Worker KataGo charge TensorFlow.js par import dynamique.
  worker: { format: 'es' },
  resolve: {
    // `@/go/rules` -> `src/go/rules`
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    // Les tests Playwright (e2e/) ne passent pas par Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**'],
    // tokens.test.ts et IconesNav.test.tsx lisent le CSS des tokens et de la barre de navigation.
    css: { include: [/tokens\.css/, /nav\.css/] },
    // Couverture (npm run test:coverage) : module des règles uniquement.
    coverage: {
      provider: 'v8',
      include: ['src/go/**'],
      exclude: ['src/go/**/*.test.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
