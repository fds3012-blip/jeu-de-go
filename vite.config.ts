import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    // Couverture (npm run test:coverage) : module des règles uniquement.
    coverage: {
      provider: 'v8',
      include: ['src/go/**'],
      exclude: ['src/go/**/*.test.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 }
    }
  }
});
