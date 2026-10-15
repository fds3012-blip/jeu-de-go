// Issue #554 : src/go/refutations-locales.gen.ts suit les problèmes et les lecteurs, et chaque réplique figée est prouvée.
//
// - À jour : l'empreinte des entrées (problèmes lus, sources des lecteurs, zones déclarées, ce générateur) est celle du
//   fichier. Sinon : `npm run refutations-locales` (régénère tout, plusieurs minutes).
// - Prouvée : chaque réplique est revérifiée sur la vraie position, avec la preuve que le fichier annonce.
// - Fidèle au texte : quand le texte relu du problème nomme la réplique (dans la zone), c'est elle qui est figée, ou
//   bien elle n'est pas prouvée.
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_PUZZLES } from '../src/content/puzzles';
import { parsePuzzles } from '../src/data/puzzles';
import { fromLabel, toLabel } from '../src/go/coords';
import { cederLaMain } from '../src/go/preuve-par-coup';
import { EMPREINTE, REFUTATIONS_LOCALES } from '../src/go/refutations-locales.gen';
import {
  butApres, butLocal, coupsFaux, empreinteDe, genererRefutationsLocales, ordreRepliques, problemesLocaux, repliqueProuvee, repliqueTient,
} from './refutationsLocales';

const FICHIER = new URL('../src/go/refutations-locales.gen.ts', import.meta.url);
const RACINE = new URL('../', import.meta.url);
const MAJ = process.env.MAJ_REFUTATIONS_LOCALES === '1';

const tous = parsePuzzles(ALL_PUZZLES);
const lire = (f: string) => readFileSync(new URL(f, RACINE), 'utf8');

describe('réfutations figées (#554) : fichier à jour', () => {
  it('src/go/refutations-locales.gen.ts est à jour (sinon : npm run refutations-locales)', async () => {
    const empreinte = empreinteDe(tous, lire);
    if (MAJ) {
      writeFileSync(FICHIER, await genererRefutationsLocales(tous, empreinte, async id => { process.stdout.write(`${id} `); await cederLaMain(); }));
      return;
    }
    expect(EMPREINTE, 'src/go/refutations-locales.gen.ts est en retard : lance `npm run refutations-locales`').toBe(empreinte);
  }, MAJ ? 3_600_000 : 10_000);

  it.skipIf(MAJ)('chaque problème lu (vie et mort, seki, course aux libertés) a sa ligne, et rien d’autre', () => {
    const ids = problemesLocaux(tous).map(p => p.id);
    expect(Object.keys(REFUTATIONS_LOCALES).every(id => ids.includes(id))).toBe(true);
    // Seul a14 (deux groupes marqués, course ouverte) n'a aucune lecture.
    expect(ids.filter(id => !REFUTATIONS_LOCALES[id])).toEqual(['a14']);
  });
});

// La revérification relit chaque preuve : plusieurs minutes au total, un test par problème.
describe.skipIf(MAJ)('réfutations figées (#554) : chaque réplique est prouvée sur la vraie position', () => {
  beforeEach(cederLaMain);
  for (const pz of problemesLocaux(tous).filter(p => REFUTATIONS_LOCALES[p.id])) {
    it(`${pz.id}`, () => {
      const r = REFUTATIONS_LOCALES[pz.id], faux = coupsFaux(pz), labels = new Set(faux.map(f => toLabel(f, pz.size)));
      // Les exceptions sont des coups faux légaux.
      for (const k of Object.keys(r.sauf ?? {})) expect(labels.has(k), `${pz.id} ${k}`).toBe(true);
      for (const f of faux) {
        const code = r.sauf?.[toLabel(f, pz.size)] ?? r.defaut;
        if (!code) continue;
        expect(repliqueTient(pz, f, code), `${pz.id} ${toLabel(f, pz.size)} → ${code}`).toBe(true);
      }
    }, 300_000);
  }
});

describe.skipIf(MAJ)('réfutations figées (#554) : la réplique nommée par le texte est jouée quand elle est prouvée', () => {
  beforeEach(cederLaMain);
  for (const pz of problemesLocaux(tous).filter(p => REFUTATIONS_LOCALES[p.id])) {
    const but = butLocal(pz);
    if (!but) continue;
    it(`${pz.id}`, () => {
      const r = REFUTATIONS_LOCALES[pz.id];
      for (const f of coupsFaux(pz)) {
        const code = r.sauf?.[toLabel(f, pz.size)] ?? r.defaut, local = butApres(pz, but, f);
        if (!code || !local || 'mycvi'.indexOf(code.slice(-1)) < 0) continue;
        // Premier point essayé : celui du texte s'il y en a un dans la zone (sinon une bonne réponse ou un point de la zone).
        const premier = ordreRepliques(pz, local, f)[0];
        if (premier === undefined || premier === fromLabel(code.slice(0, -1), pz.size)) continue;
        // La réplique figée n'est pas la première essayée : la première n'est pas prouvée (revérifié).
        expect(repliqueProuvee(pz, but, f)?.reponse, `${pz.id} ${toLabel(f, pz.size)}`).toBe(fromLabel(code.slice(0, -1), pz.size));
      }
    }, 300_000);
  }
});
