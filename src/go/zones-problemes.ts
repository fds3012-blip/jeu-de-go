// Issue #554 : métadonnées de lecture des problèmes de vie et mort, seki et course aux libertés, quand le plateau ne
// suffit pas à les déduire (src/go/refutation-locale.ts déduit sinon la zone de l'espace du groupe marqué).
// Les textes des lots (src/content/lots) et les migrations ne changent pas : ces données vivent ici.
// Chaque zone déclarée est vérifiée fermée (refutation-locale.ts, `defautsZone`) avant toute preuve.

export interface LectureDeclaree {
  /** Course aux libertés : ta chaîne (un point), quand seule la chaîne adverse est marquée. */
  course?: string;
  /** Vie et mort, seki : le groupe dont le sort se lit (un point), quand les pierres marquées en forment plusieurs. */
  cible?: string;
  /** Points jouables (vides ou non) ; à défaut, l'espace du groupe cible, ou les libertés des deux chaînes. */
  zone?: readonly string[];
  /**
   * #558, fin de partie et comptage (src/go/refutation-fin.ts) : points de frontière jouables quand la région ouverte
   * est trop grande pour être déduite (`zone`), et pierres mortes retirées au comptage (`mortes`, prouvées mortes).
   */
  fin?: { zone?: readonly string[]; mortes?: readonly string[] };
}

export const LECTURES_DECLAREES: Readonly<Record<string, LectureDeclaree>> = {
  // Courses aux libertés où seule la chaîne blanche est marquée : ta chaîne est celle que nomme l'énoncé
  // (« ton groupe C1-C4 ») ou, sans nom, la chaîne noire qui partage les libertés de la chaîne marquée.
  d05: { course: 'C1' }, d07: { course: 'C1' }, d08: { course: 'G6' }, d09: { course: 'G2' }, d10: { course: 'C2' },
  d11: { course: 'C2' }, d12: { course: 'C2' }, d13: { course: 'G6' },
  f02: { course: 'G6' }, f08: { course: 'C1' }, f09: { course: 'C1' }, f10: { course: 'G2' }, f11: { course: 'C2' },
  f12: { course: 'C6' },
  o03: { course: 'C2' }, o10: { course: 'C2' }, v13: { course: 'E2' },
  // #558, lot W (src/go/lot-w.test.ts, FIN) : la frontière ouverte donne sur tout le bas du plateau ; les points de
  // frontière sont ceux de la preuve du lot. A9 (w06) et J9 (w08) sont les pierres mortes des énoncés.
  w04: { fin: { zone: ['E5', 'E4', 'E3', 'D3', 'F3'] } },
  w05: { fin: { zone: ['E7', 'E3', 'D3', 'C3'] } },
  w06: { fin: { zone: ['F5', 'F4', 'F6', 'A8'], mortes: ['A9'] } },
  w08: { fin: { zone: ['E6', 'F6'], mortes: ['J9'] } },
  w09: { fin: { zone: ['G7', 'F7', 'B2', 'C1'] } },
  // #733, lot AC (src/go/lot-ac.test.ts) : les points de frontière (les deux de la paire et les dames) et les pierres mortes des énoncés.
  ac01: { fin: { zone: ['E8', 'F8'] } },
  ac02: { fin: { zone: ['E1', 'D1'], mortes: ['F5'] } },
  ac03: { fin: { zone: ['C4', 'D5', 'F5', 'F4'], mortes: ['A1'] } },
  ac04: { fin: { zone: ['E1', 'F1', 'E4', 'F6'] } },
  ac05: { fin: { zone: ['F8', 'G6', 'F5', 'F4'], mortes: ['A3', 'H9'] } },
  // #558, lot AA (src/go/lot-aa.test.ts, SPEC) : E3 prend F3 (un ko), ce n'est pas un point ouvert ; F3 redevient jouable.
  aa01: { fin: { zone: ['E9', 'E3', 'F3'] } },
};
