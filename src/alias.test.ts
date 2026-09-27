// Vérifie que l'alias `@/` -> `src/` fonctionne (tsconfig + Vite/Vitest).
import { LETTERS } from '@/go/coords';

test("l'alias @/ résout src/", () => {
  expect(LETTERS).not.toContain('I');
});
