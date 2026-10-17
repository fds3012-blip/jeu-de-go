import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { precacheSw } from './outils/pwa';
import { prechargerAnglais } from './outils/prechargerAnglais';
import { pagesApercu } from './outils/apercus';
import { pagesReferencement } from './outils/referencement/pages';
import { pluginsSentry, sourcemapVite } from './outils/sentrySourcemaps';
import { entetesSecurite } from './outils/csp';

// Plugin Sentry (#474) : chargé seulement avec SENTRY_AUTH_TOKEN (Vercel) ; sinon, liste vide.
const sentry = await pluginsSentry(process.env);

export default defineConfig({
  // precacheSw : liste des fichiers du service worker, injectée dans dist/sw.js (outils/pwa.ts).
  // prechargerAnglais : pour un joueur en anglais, ses textes (#325) partent en même temps que le JS d'entrée.
  // pagesApercu : une page d'aperçu (Open Graph) par lien court partagé, copie de dist/index.html (#285, #364).
  // pagesReferencement : pages statiques indexées (/apprendre-le-go…), sitemap.xml et robots.txt, sans le JS de l'app (#472).
  // pluginsSentry (#474) : avec SENTRY_AUTH_TOKEN seulement (Vercel), envoie les source maps à Sentry puis les efface de dist/.
  // entetesSecurite (#531) : balise CSP (empreintes des scripts en ligne) dans chaque page de dist/, après les autres ;
  // `vite preview` sert les en-têtes de sécurité de vercel.json (outils/csp.ts).
  plugins: [react(), precacheSw(), prechargerAnglais(), pagesApercu(), pagesReferencement(), ...sentry, entetesSecurite()],
  build: {
    // Source maps « cachées » (#474) : produites seulement pour Sentry (jeton présent), jamais référencées ni publiées.
    sourcemap: sourcemapVite(process.env),
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
    // boucleLibre (#586) : un test qui occupe la boucle d'événements plus de 30 s d'un seul bloc échoue, avec son nom.
    setupFiles: ['./src/content/anglais.setup.ts', './outils/boucleLibre.setup.ts'],
    // #586 : en CI, résumé lisible dans la page du job (erreurs hors test, tests lents, plus longs blocs).
    reporters: process.env.GITHUB_STEP_SUMMARY ? ['default', 'github-actions', './outils/resumeCi.ts'] : ['default'],
    // Les tests Playwright (e2e/) ne passent pas par Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**'],
    // #407 : un cœur reste au processus principal, qui répond ainsi vite aux workers. La vraie cause de « Timeout
    // calling onTaskUpdate » était un calcul synchrone de plus de 60 s dans un worker (#586, outils/boucleLibre.setup.ts).
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
