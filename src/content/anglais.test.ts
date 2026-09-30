import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anglais, langueAuChargement } from './anglais';
import { ANGLAIS } from './anglaisContenu';
import { CATALOGUES, langue, traduire } from './i18n';
import { TRADUCTIONS } from './lessons';
import { TRADUCTIONS_PROBLEMES } from './problemesLangue';

const SRC = fileURLToPath(new URL('..', import.meta.url));
function sources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? sources(join(dossier, e.name)) : /\.(ts|tsx)$/.test(e.name) && !/\.(test|setup)\.tsx?$/.test(e.name) ? [join(dossier, e.name)] : []);
}

describe('textes anglais chargés à la demande (#325)', () => {
  it("aucun module de l'app n'importe les textes anglais directement, sauf anglaisContenu.ts", () => {
    // Un import (non `import type`) de en.ts, problemes.en.ts ou lessons.en.js les remettrait dans le JS initial.
    const direct = /^import (?!type ).*from '[^']*(\/en|\/problemes\.en|\/lessons\.en\.js)';?$/m;
    const fautifs = sources(SRC).filter(f => !f.endsWith('anglaisContenu.ts') && direct.test(readFileSync(f, 'utf8')));
    expect(fautifs.map(f => f.slice(SRC.length))).toEqual([]);
    expect(readFileSync(join(SRC, 'content/anglais.ts'), 'utf8')).toContain("await import('./anglaisContenu')");
  });

  it('une fois chargés, interface, leçons et problèmes lisent les mêmes textes', () => {
    // Enregistrés pour tous les tests par anglais.setup.ts, comme le fait anglais.ts dans l'app.
    expect(anglais()).toBe(ANGLAIS);
    expect(CATALOGUES.en).toBe(ANGLAIS.ui);
    expect(TRADUCTIONS.en.lecons).toBe(ANGLAIS.lecons);
    expect(TRADUCTIONS.en.chapitres).toBe(ANGLAIS.chapitres);
    expect(TRADUCTIONS_PROBLEMES.en).toBe(ANGLAIS.problemes);
    expect(traduire('en', 'nav.aria')).toBe('Main navigation');
  });

  it('hors navigateur, la langue au chargement reste le français', () => {
    expect(langueAuChargement()).toBe('fr');
    expect(langue()).toBe('fr');
  });
});
