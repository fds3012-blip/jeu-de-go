// Contrat de game-action (#344) et déploiement automatique des fonctions : garde-fous statiques.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GO_FILES } from '../../scripts/sync-functions.mjs';
import { CONTRAT_GAME_ACTION, estDemandeVersion, reponseVersion } from './contrat';

const racine = resolve(__dirname, '../..');
const lire = (chemin: string) => readFileSync(resolve(racine, chemin), 'utf8');

describe('contrat de game-action', () => {
  it('est un entier, au moins 3 (première version qui répond à l’action version)', () => {
    expect(Number.isInteger(CONTRAT_GAME_ACTION)).toBe(true);
    expect(CONTRAT_GAME_ACTION).toBeGreaterThanOrEqual(3);
    expect(reponseVersion()).toEqual({ ok: true, contrat: CONTRAT_GAME_ACTION });
  });

  it('reconnaît la demande de version, et elle seule', () => {
    expect(estDemandeVersion({ action: 'version' })).toBe(true);
    for (const b of [null, undefined, 'version', {}, { action: 'move' }, { action: 'defi_coup' }, { action: 'VERSION' }]) {
      expect(estDemandeVersion(b)).toBe(false);
    }
  });

  it('est copié dans la fonction serveur, qui répond à la version avant toute connexion', () => {
    expect(GO_FILES).toContain('contrat.ts');
    const index = lire('supabase/functions/game-action/index.ts');
    expect(index).toMatch(/from '\.\/go\/contrat\.ts'/);
    const version = index.indexOf('if (estDemandeVersion(body)) return json(200, reponseVersion());');
    expect(version).toBeGreaterThan(0);
    expect(version).toBeLessThan(index.indexOf('auth.getUser'));
    expect(version).toBeLessThan(index.indexOf("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"));
  });
});

describe('workflow de déploiement des fonctions (#344)', () => {
  const wf = lire('.github/workflows/deployer-fonctions.yml');

  it('se déclenche sur main quand les fonctions ou les règles copiées changent', () => {
    expect(wf).toMatch(/push:\s*\n\s*branches: \[main\]/);
    for (const p of ["'supabase/functions/**'", "'src/go/**'", "'scripts/sync-functions.mjs'"]) expect(wf).toContain(p);
    expect(wf).not.toMatch(/pull_request/);
  });

  it('se désactive proprement sans le secret, et ne contient aucun secret en clair', () => {
    expect(wf).toContain('secrets.SUPABASE_ACCESS_TOKEN');
    expect(wf).toMatch(/if: needs\.secret\.outputs\.present == 'true'/);
    expect(wf).not.toMatch(/sbp_[A-Za-z0-9]{10,}|service_role|eyJ[A-Za-z0-9_-]{20,}/);
    expect(wf).toMatch(/permissions:\s*\n\s*contents: read/);
  });

  it('vérifie la copie des règles puis déploie avec supabase functions deploy sur le bon projet', () => {
    const copie = wf.indexOf('node scripts/sync-functions.mjs');
    const deploy = wf.indexOf('supabase functions deploy');
    expect(copie).toBeGreaterThan(0);
    expect(deploy).toBeGreaterThan(copie);
    expect(wf).toContain('PROJET_SUPABASE: xjvsalkvpgcjrznznxoi');
    expect(wf).toContain('--project-ref "$PROJET_SUPABASE"');
  });

  it('la vérification après déploiement lit bien la constante du contrat', () => {
    const ligne = lire('src/go/contrat.ts').split('\n').find(l => l.startsWith('export const CONTRAT_GAME_ACTION'))!;
    expect(ligne.replace(/^export const CONTRAT_GAME_ACTION = ([0-9]+);.*/, '$1')).toBe(String(CONTRAT_GAME_ACTION));
    expect(wf).toContain("s/^export const CONTRAT_GAME_ACTION = ([0-9]+);.*/");
  });
});
