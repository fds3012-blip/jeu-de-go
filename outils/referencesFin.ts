// Issue #586 : valeurs de référence des problèmes lus par compte de points (meilleuresFin, outils/refutationsLocales.ts),
// figées pour les tests. Les calculer coûte cher (ab01 : près de deux minutes, d'un seul bloc) ; chaque fichier de test
// qui appelait butsDe les recalculait (jusqu'à trois fois ab01 par passage de la CI, dont une pendant la collecte).
//
// Elles restent prouvées à chaque passage, une seule fois chacune :
// - fin de partie et comptage : src/go/refutation-fin.test.ts recalcule la valeur de chaque coup de départ, dans les deux
//   modèles de ko, et compare à cette table ;
// - les autres (ko, aa01) : outils/refutationsLocales.test.ts appelle meilleuresFin et compare.
// Le générateur (`npm run refutations-locales`) n'utilise pas cette table : il recalcule tout (butsDe).
import type { Puzzle } from '../src/data/puzzles';
import type { ReferencesFin } from '../src/go/refutation-fin';
import { butFin, butLocal, type Buts } from './refutationsLocales';

/** Valeur du bon coup (toi maître du ko, puis ko simple) et de la passe, du point de vue du joueur ; null : non prouvée. */
export const REFERENCES_FIN: Readonly<Record<string, ReferencesFin>> = {
  w04: { maitre: 1, simple: 1, passe: -30 },
  w05: { maitre: -2, simple: -2, passe: -31 },
  w06: { maitre: 10, simple: 10, passe: -22 },
  w07: { maitre: 0, simple: 0, passe: 0 },
  w08: { maitre: 7, simple: 7, passe: -24 },
  w09: { maitre: 7, simple: 7, passe: -18 },
  y01: { maitre: -8, simple: -8, passe: -11 },
  y02: { maitre: -17, simple: -17, passe: -22 },
  y03: { maitre: 2, simple: 2, passe: -2 },
  y04: { maitre: -27, simple: -27, passe: -29 },
  z04: { maitre: -8, simple: -8, passe: -13 },
  z08: { maitre: -1, simple: -1, passe: -9 },
  z12: { maitre: -7, simple: -7, passe: -15 },
  aa01: { maitre: null, simple: -1, passe: 0 },
  aa03: { maitre: -6, simple: -6, passe: -8 },
  ab01: { maitre: -12, simple: -12, passe: -15 },
  ab05: { maitre: -14, simple: -14, passe: -19 },
};

/** Comme butsDe, mais avec les références figées : aucune recherche de compte de points. */
export function butsFiges(pz: Puzzle): Buts {
  const local = butLocal(pz), fin = local ? null : butFin(pz);
  if (fin && !REFERENCES_FIN[pz.id]) throw new Error(`${pz.id} : référence de fin de partie absente d'outils/referencesFin.ts (valeur de meilleuresFin)`);
  return { local, fin, meilleures: fin ? REFERENCES_FIN[pz.id] : undefined };
}
