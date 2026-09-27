// Configuration ESLint (flat config) : TypeScript + React Hooks.
// Les règles purement stylistiques sont laissées à Prettier.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Style courant dans le code existant : `cond ? a() : b()` et `cond && a()`.
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    },
  },
  {
    // Service worker : contexte ServiceWorkerGlobalScope.
    files: ['public/sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } },
  },
  {
    // Fichiers de configuration, scripts et tests exécutés sous Node.
    files: ['*.config.{ts,js}', 'e2e/**/*.ts', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
