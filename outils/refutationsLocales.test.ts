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
import { prouverLocale, jouer, signatureLocale, type PreuveLocale } from '../src/go/refutation-locale';
import { EMPREINTE, REFUTATIONS_LOCALES } from '../src/go/refutations-locales.gen';
import { startOf } from '../src/data/puzzles';
import {
  butApres, butsDe, coupsFaux, decoder, empreinteDe, genererRefutationsLocales, ordreRepliques, ordreRepliquesFin, problemesLocaux, repliqueProuvee, repliqueTient,
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

  it.skipIf(MAJ)('chaque problème lu (vie et mort, seki, course, fin de partie, comptage, ko) a sa ligne, et rien d’autre', () => {
    const ids = problemesLocaux(tous).map(p => p.id);
    expect(Object.keys(REFUTATIONS_LOCALES).every(id => ids.includes(id))).toBe(true);
    expect(ids.filter(id => !REFUTATIONS_LOCALES[id])).toEqual([]);
    // #558 : les 7 problèmes de ko et les 14 de fin de partie et de comptage sont lus.
    for (const id of ['x01', 'x02', 'x03', 'aa01', 'aa12', 'aa17', 'aa20', 'w04', 'w07', 'y01', 'z12', 'aa03']) expect(REFUTATIONS_LOCALES[id], id).toBeTruthy();
  });

  it.skipIf(MAJ)('chaque code se lit (point, preuve, perte, fait)', () => {
    for (const [id, r] of Object.entries(REFUTATIONS_LOCALES)) {
      const size = tous.find(p => p.id === id)!.size;
      for (const code of [r.defaut, ...Object.values(r.sauf ?? {})]) if (code) expect(decoder(code, size), `${id} ${code}`).not.toBeNull();
    }
    expect(decoder('F4f2m', 9)).toEqual({ reponse: fromLabel('F4', 9), preuve: 'fin', perte: 2, fait: 'morte' });
    expect(decoder('E3k', 9)).toEqual({ reponse: fromLabel('E3', 9), preuve: 'ko' });
    expect(decoder('E1m', 9)).toEqual({ reponse: fromLabel('E1', 9), preuve: 'mort' });
    expect(decoder('E1f2z', 9)).toBeNull();
  });
});

// La revérification relit chaque preuve : plusieurs minutes au total, un test par problème.
describe.skipIf(MAJ)('réfutations figées (#554, #558) : chaque réplique est prouvée sur la vraie position', () => {
  beforeEach(cederLaMain);
  for (const pz of problemesLocaux(tous).filter(p => REFUTATIONS_LOCALES[p.id])) {
    it(`${pz.id}`, () => {
      const r = REFUTATIONS_LOCALES[pz.id], faux = coupsFaux(pz), labels = new Set(faux.map(f => toLabel(f, pz.size)));
      // Mémoire par signature locale (src/go/refutation-locale.ts, signatureLocale) : vérifiée plus bas.
      const memo = new Map<string, PreuveLocale | null>(), buts = butsDe(pz);
      // Les exceptions sont des coups faux légaux.
      for (const k of Object.keys(r.sauf ?? {})) expect(labels.has(k), `${pz.id} ${k}`).toBe(true);
      for (const f of faux) {
        const code = r.sauf?.[toLabel(f, pz.size)] ?? r.defaut;
        if (!code) continue;
        expect(repliqueTient(pz, f, code, memo, buts), `${pz.id} ${toLabel(f, pz.size)} → ${code}`).toBe(true);
      }
    }, 300_000);
  }
});

describe.skipIf(MAJ)('réfutations figées (#554, #558) : la réplique nommée par le texte est jouée quand elle est prouvée', () => {
  beforeEach(cederLaMain);
  for (const pz of problemesLocaux(tous).filter(p => REFUTATIONS_LOCALES[p.id])) {
    const buts = butsDe(pz);
    if (!buts.local && !buts.fin) continue;
    it(`${pz.id}`, () => {
      const r = REFUTATIONS_LOCALES[pz.id], memo = new Map<string, PreuveLocale | null>();
      for (const f of coupsFaux(pz)) {
        const d = decoder(r.sauf?.[toLabel(f, pz.size)] ?? r.defaut, pz.size);
        if (!d || d.preuve === 'prendre' || d.preuve === 'sauver') continue;
        // Premier point essayé : celui du texte s'il y en a un dans la zone (sinon une bonne réponse ou un point de la zone).
        const local = buts.local && butApres(pz, buts.local, f);
        const premier = (local ? ordreRepliques(pz, local, f) : buts.fin ? ordreRepliquesFin(pz, buts.fin, f) : [])[0];
        if (premier === undefined || premier === d.reponse) continue;
        // La réplique figée n'est pas la première essayée : la première n'est pas prouvée (revérifié).
        expect(repliqueProuvee(pz, buts, f, memo)?.reponse, `${pz.id} ${toLabel(f, pz.size)}`).toBe(d.reponse);
      }
    }, 300_000);
  }
});

describe.skipIf(MAJ)('réfutations figées (#554) : la mémoire par signature locale ne change aucune preuve', () => {
  beforeEach(cederLaMain);
  // Problèmes rapides de chaque genre : chaque coup faux et chaque réplique de la zone, avec et sans mémoire.
  for (const id of ['m01', 'q01', 'q02', 'r01', 'z02', 'd10', 'aa04']) {
    it(`${id} : même preuve, que la position ait été lue ou que sa signature l’ait déjà été`, () => {
      const pz = tous.find(p => p.id === id)!, but = butsDe(pz).local!, memo = new Map<string, PreuveLocale | null>();
      const signatures = new Set<string>();
      let essais = 0;
      for (const f of coupsFaux(pz)) {
        const local = butApres(pz, but, f), apresFaux = jouer(startOf(pz).pos, f)!;
        if (!local) continue;
        for (const m of local.zone) {
          const r = apresFaux.board[m] ? null : jouer(apresFaux, m);
          if (!r) continue;
          essais++;
          signatures.add(signatureLocale(r, local.zone));
          expect(prouverLocale(r, local, pz.toPlay, { memo }), `${id} ${toLabel(f, 9)} ${toLabel(m, 9)}`).toBe(prouverLocale(r, local, pz.toPlay));
        }
      }
      // La mémoire sert : bien moins de signatures que de positions.
      expect(signatures.size).toBeLessThan(essais / 4);
    }, 300_000);
  }
});
