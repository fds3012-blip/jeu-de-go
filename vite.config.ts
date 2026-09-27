import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
