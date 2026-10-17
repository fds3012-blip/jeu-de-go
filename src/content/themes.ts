// Thèmes des problèmes (issue #200) : de la leçon à la pratique.
// Chaque problème de la banque (tous ceux de ALL_PUZZLES) reçoit un thème, d'après ce qu'il enseigne : le coup juste
// et son explication, pas seulement le titre. Les fichiers de lots et la base ne changent pas : le thème vit ici.
// Vérifié par src/content/themes.test.ts (chaque problème a un thème, chaque thème de leçon a assez de problèmes).

// #563 : le type Theme, THEMES et THEMES_DE_LECON sont dans themesLecons.ts (JS initial), réexportés ici.
import { THEMES, THEMES_DE_LECON, type Theme } from './themesLecons';
export { THEMES, THEMES_DE_LECON, type Theme } from './themesLecons';

const PAR_THEME: Record<Theme, readonly string[]> = {
  capture: ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a15', 'a16', 'a18', 'a20', 'b1', 'e01', 'e02', 'n01', 'n02', 'n16', 'v01',
    // Lot AB (#557) : relier et mourir (manque de libertés), au niveau club.
    'ab09'],
  atari: ['a07', 'a08', 'a10', 'a17', 'a19', 'b4', 'b5', 'e03', 'e05', 'e06', 's1', 's3', 'n03', 'n04', 'n05', 'n08', 'n09', 'n13', 'n14', 'n17', 'p01', 'v02', 'v03', 'v04'],
  'double-atari': ['a11', 'a13', 'b3', 'c1', 'e10', 'j01', 'j04', 'n15', 'p02', 'v06', 'v10'],
  bord: ['a09', 'a12', 'b2', 'e04', 'e07', 'e08', 'e09', 'e11', 'e12', 'e13', 'e14', 'e15', 'k01', 'k02', 'n06', 'n07', 'n11', 'n12', 's01', 's05'],
  echelle: ['b6', 'c2', 'i09', 'k03', 'k05', 'k06', 'k07', 'o08', 'o11', 's04', 'v05', 'v07'],
  filet: ['c3', 'i10', 'k09', 'o01', 'o04', 'o06', 'o09', 'o12', 's02', 's06', 't01', 'v08', 'v11'],
  'relier-couper': [
    'd01', 'd02', 'd03', 'd04', 'd06', 'f01', 'f03', 'f04', 'f05', 'f06', 'f07',
    'g01', 'g02', 'g03', 'g04', 'g05', 'h01', 'j12', 'k08', 'k10', 's2', 's4', 'n10', 'n18', 's03',
    'u01', 'u02', 'u03', 'u04', 'u05', 'u06', 'u07',
    // Lot AB (#557) : couper par en dessous avant que Blanc relie.
    'ab15',
  ],
  'vie-mort': [
    'i01', 'i02', 'i03', 'i04', 'i05', 'i06', 'i07', 'i08',
    'j05', 'j06', 'j07', 'j08', 'j09', 'j10', 'j11', 'k04',
    'm01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'm13',
    'v1', 'v2', 'v3', 'v4', 'q01', 'q02', 'q03',
    'r01', 'r02', 'r03', 'r04', 'r05', 'r06',
    't02', 't03', 't04', 't05', 't06',
    'u08', 'u09', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15',
    'v14', 'v15', 'v16',
    // Lot Z (#539) : points miai, grappe de cinq, six du coin.
    'z01', 'z03', 'z05', 'z09', 'z10', 'z15',
    // Lot AA (#548) : vie et mort qui se lit en 3 à 5 coups (point vital et suites miai, agrandir l’espace).
    'aa05', 'aa06', 'aa08', 'aa10', 'aa11', 'aa13', 'aa15', 'aa16', 'aa18', 'aa19',
    // Lot AB (#557) : placements et points vitaux qui se lisent en 5 à 8 coups, de 5 kyu vers le dan.
    'ab02', 'ab03', 'ab06', 'ab10', 'ab11', 'ab12', 'ab16', 'ab17', 'ab19', 'ab20', 'ab21',
  ],
  semeai: ['a14', 'd05', 'd07', 'd08', 'd09', 'd10', 'd11', 'd12', 'd13', 'f02', 'f08', 'f09', 'f10', 'f11', 'f12', 'o03', 'o10', 'v13',
    // Lot Z (#539) : libertés communes, yeux dans la course.
    'z02', 'z06', 'z07', 'z11', 'z13', 'z14'],
  'prise-en-retour': ['c4', 'j02', 'j03', 'o02', 'o05', 'o07', 'p03', 'v09', 'v12',
    // Lot AA (#548) : se mettre en atari exprès, puis reprendre.
    'aa02', 'aa07',
    // Lot AB (#557) : deux jetés dans un anneau.
    'ab04'],
  // Lot W (#16) : les séries des leçons 14 à 16.
  seki: ['w01', 'w02', 'w03',
    // Lot AA (#548) : seki dans le coin, au bord, contre un carré.
    'aa04', 'aa09', 'aa14',
    // Lot AB (#557) : seki contre des pierres enfermées.
    'ab07', 'ab13'],
  // Lot Y (#500) : la série « Fin de partie » des problèmes par thème (#471).
  'fin-de-partie': ['w04', 'w05', 'w06', 'y01', 'y02', 'y03', 'y04', 'z04', 'z08', 'z12',
    // Lot AA (#548) : le hane au premier rang avant les dames.
    'aa03',
    // Lot AB (#557) : bloquer la glissade au contact, l'atari qui bloque.
    'ab01', 'ab05'],
  comptage: ['w07', 'w08', 'w09'],
  // Lot X (#16) : les séries des leçons 4 (ko), 6 et 8 (ouverture).
  ko: ['x01', 'x02', 'x03',
    // Lot AA (#548) : fermer un ko en fin de partie, vivre ou tuer par un ko.
    'aa01', 'aa12', 'aa17', 'aa20',
    // Lot AB (#557) : vivre ou tuer par un ko, avec des pierres déjà dedans.
    'ab08', 'ab14', 'ab18'],
  ouverture: ['x04', 'x05', 'x06', 'x07', 'x08'],
};

/** Thème de chaque problème, par identifiant. */
export const THEME_DU_PROBLEME: Readonly<Record<string, Theme>> = Object.fromEntries(
  THEMES.flatMap(t => PAR_THEME[t].map(id => [id, t] as const)),
);

export function themeDe(id: string): Theme | undefined {
  return THEME_DU_PROBLEME[id];
}


/**
 * Problèmes ouverts à un débutant : difficulté sous 850, c'est-à-dire les paliers Débutant, Novice et Apprenti
 * (30 à 15 kyu, voir src/app/paliers.ts). Au-delà commence le palier « Joueur de club ».
 */
export const OUVERT_DEBUTANT = 850;

/** Taille d'une série d'entraînement. */
export const TAILLE_SERIE = 3;

/**
 * Série d'entraînement de fin de leçon : dans chaque thème de la leçon, les plus faciles non réussis d'abord,
 * puis, s'il n'en reste plus, les plus faciles déjà réussis. Plusieurs thèmes : on les prend chacun à leur tour.
 * Vide si la leçon n'a pas de thème.
 *
 * `redite` (#237, N3) : vrai pour un problème qui répète un exercice de la leçon qui vient d'être jouée
 * (`estRedite` de redites.ts : même position à symétrie près, ou liste d'exclusion). Il passe en dernier :
 * il ne sert que si le thème n'a rien d'autre. Exemple : après la leçon 1, la pratique ne repropose ni b1
 * « Capture la pierre » (l'étape 4 elle-même) ni a01 « Première capture » (la même forme).
 */
export function serieDeLecon<T extends { id: string; difficulty: number }>(
  lecon: string, liste: readonly T[], reussis: ReadonlySet<string>, n = TAILLE_SERIE, redite: (p: T) => boolean = () => false,
): T[] {
  return serieDeThemes(THEMES_DE_LECON[lecon] ?? [], liste, reussis, n, redite);
}

/**
 * #590 : « S'entraîner sur ce thème », depuis la page d'un thème d'Apprendre : la même série que la fin de leçon
 * (les plus faciles non réussis d'abord), sur ce seul thème. Chaque thème a au moins 3 problèmes (themes.test.ts).
 */
export function serieDeTheme<T extends { id: string; difficulty: number }>(
  theme: Theme, liste: readonly T[], reussis: ReadonlySet<string>, n = TAILLE_SERIE,
): T[] {
  return serieDeThemes([theme], liste, reussis, n);
}

function serieDeThemes<T extends { id: string; difficulty: number }>(
  themes: readonly Theme[], liste: readonly T[], reussis: ReadonlySet<string>, n: number, redite: (p: T) => boolean = () => false,
): T[] {
  const facile = (a: T, b: T) => a.difficulty - b.difficulty || a.id.localeCompare(b.id);
  const files = themes.map(t => {
    const du = liste.filter(p => THEME_DU_PROBLEME[p.id] === t).sort(facile);
    const neufs = du.filter(p => !redite(p));
    return [...neufs.filter(p => !reussis.has(p.id)), ...neufs.filter(p => reussis.has(p.id)), ...du.filter(redite)];
  });
  const out: T[] = [];
  for (let rang = 0; out.length < n && files.some(f => rang < f.length); rang++) {
    for (const f of files) if (rang < f.length && out.length < n) out.push(f[rang]);
  }
  return out;
}
