import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { precacheSw } from './outils/pwa';
import { prechargerAnglais } from './outils/prechargerAnglais';
import { pagesApercu } from './outils/apercus';

export default defineConfig({
  // precacheSw : liste des fichiers du service worker, injectée dans dist/sw.js (outils/pwa.ts).
  // prechargerAnglais : pour un joueur en anglais, ses textes (#325) partent en même temps que le JS d'entrée.
  // pagesApercu : une page d'aperçu (Open Graph) par lien court partagé, copie de dist/index.html (#285, #364).
  plugins: [react(), precacheSw(), prechargerAnglais(), pagesApercu()],
  build: {
    rollupOptions: {
      output: {
        // Bibliothèques à part : leur empreinte ne change pas quand le code de l'app change,
        // un joueur qui revient après un déploiement ne les retélécharge pas.
        // Budget de taille vérifié par scripts/budget-bundle.mjs (CI).
        // Noms neutres : des tests e2e guettent les requêtes dont l'adresse contient « supabase ».
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'lib-react';
          if (/node_modules\/(@supabase|iceberg-js)\//.test(id)) return 'lib-donnees';
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
    // Textes anglais chargés à la demande dans l'app (#325) : enregistrés d'office pour les tests.
    setupFiles: ['./src/content/anglais.setup.ts'],
    // Les tests Playwright (e2e/) ne passent pas par Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**'],
    // #407 : un cœur reste au processus principal. Sinon, quand les tests lourds (moteur, preuves des lots) prennent
    // tous les cœurs, il ne répond plus aux workers (« Timeout calling onTaskUpdate ») et un run vert échoue.
    maxWorkers: Math.max(1, availableParallelism() - 1),
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
