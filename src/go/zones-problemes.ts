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
}

export const LECTURES_DECLAREES: Readonly<Record<string, LectureDeclaree>> = {
  // Courses aux libertés où seule la chaîne blanche est marquée : ta chaîne est celle que nomme l'énoncé
  // (« ton groupe C1-C4 ») ou, sans nom, la chaîne noire qui partage les libertés de la chaîne marquée.
  d05: { course: 'C1' }, d07: { course: 'C1' }, d08: { course: 'G6' }, d09: { course: 'G2' }, d10: { course: 'C2' },
  d11: { course: 'C2' }, d12: { course: 'C2' }, d13: { course: 'G6' },
  f02: { course: 'G6' }, f08: { course: 'C1' }, f09: { course: 'C1' }, f10: { course: 'G2' }, f11: { course: 'C2' },
  f12: { course: 'C6' },
  o03: { course: 'C2' }, o10: { course: 'C2' }, v13: { course: 'E2' },
};
