// Vitest (setupFiles, vite.config.ts) : les tests comparent souvent le français et l'anglais ; en Node, la langue
// détectée est le français, donc src/content/anglais.ts ne charge pas l'anglais tout seul (#325).
import { enregistrerAnglais } from './anglais';
import { ANGLAIS } from './anglaisContenu';

enregistrerAnglais(ANGLAIS);
