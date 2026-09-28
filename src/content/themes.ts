// Thèmes des problèmes (issue #200) : de la leçon à la pratique.
// Chaque problème de la banque (tous ceux de ALL_PUZZLES) reçoit un thème, d'après ce qu'il enseigne : le coup juste
// et son explication, pas seulement le titre. Les fichiers de lots et la base ne changent pas : le thème vit ici.
// Vérifié par src/content/themes.test.ts (chaque problème a un thème, chaque thème de leçon a assez de problèmes).

export type Theme =
  /** Capturer tout de suite une pierre ou un groupe en atari (une seule liberté). */
  | 'capture'
  /** Atari : mettre en atari vers ses pierres, ou sauver une pierre en atari (s'allonger, prendre la pierre qui serre). */
  | 'atari'
  /** Un coup qui met deux pierres (ou deux groupes) en atari à la fois. */
  | 'double-atari'
  /** Pousser ou enfermer contre le bord : l'atari du bon côté, la sortie fermée vers le centre. */
  | 'bord'
  /** Échelle : une suite d'atari en zigzag, cassée ou non par une pierre sur le chemin. */
  | 'echelle'
  /** Filet (geta) : fermer les sorties sans toucher la pierre. */
  | 'filet'
  /** Relier ses pierres, couper celles de l'adversaire, sauver ou prendre les pierres de coupe. */
  | 'relier-couper'
  /** Vie et mort : faire deux yeux ou les empêcher (point vital, faux œil, manque de libertés). */
  | 'vie-mort'
  /** Course aux libertés (semeai) : deux groupes s'entourent, le premier qui prend les libertés de l'autre gagne. */
  | 'semeai'
  /** Prise en retour (snapback) : sacrifier une pierre pour reprendre plus aussitôt. */
  | 'prise-en-retour';

export const THEMES: readonly Theme[] = [
  'capture', 'atari', 'double-atari', 'bord', 'echelle', 'filet', 'relier-couper', 'vie-mort', 'semeai', 'prise-en-retour',
];

const PAR_THEME: Record<Theme, readonly string[]> = {
  capture: ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a15', 'a16', 'a18', 'a20', 'b1', 'e01', 'e02', 'n01', 'n02', 'n16'],
  atari: ['a07', 'a08', 'a10', 'a17', 'a19', 'b4', 'b5', 'e03', 'e05', 'e06', 's1', 's3', 'n03', 'n04', 'n05', 'n08', 'n09', 'n13', 'n14', 'n17', 'p01'],
  'double-atari': ['a11', 'a13', 'b3', 'c1', 'e10', 'j01', 'j04', 'n15', 'p02'],
  bord: ['a09', 'a12', 'b2', 'e04', 'e07', 'e08', 'e09', 'e11', 'e12', 'e13', 'e14', 'e15', 'k01', 'k02', 'n06', 'n07', 'n11', 'n12'],
  echelle: ['b6', 'c2', 'i09', 'k03', 'k05', 'k06', 'k07', 'o08', 'o11'],
  filet: ['c3', 'i10', 'k09', 'o01', 'o04', 'o06', 'o09', 'o12'],
  'relier-couper': [
    'd01', 'd02', 'd03', 'd04', 'd06', 'f01', 'f03', 'f04', 'f05', 'f06', 'f07',
    'g01', 'g02', 'g03', 'g04', 'g05', 'h01', 'j12', 'k08', 'k10', 's2', 's4', 'n10', 'n18',
  ],
  'vie-mort': [
    'i01', 'i02', 'i03', 'i04', 'i05', 'i06', 'i07', 'i08',
    'j05', 'j06', 'j07', 'j08', 'j09', 'j10', 'j11', 'k04',
    'm01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'm13',
    'v1', 'v2', 'v3', 'v4', 'q01', 'q02', 'q03',
  ],
  semeai: ['a14', 'd05', 'd07', 'd08', 'd09', 'd10', 'd11', 'd12', 'd13', 'f02', 'f08', 'f09', 'f10', 'f11', 'f12', 'o03', 'o10'],
  'prise-en-retour': ['c4', 'j02', 'j03', 'o02', 'o05', 'o07', 'p03'],
};

/** Thème de chaque problème, par identifiant. */
export const THEME_DU_PROBLEME: Readonly<Record<string, Theme>> = Object.fromEntries(
  THEMES.flatMap(t => PAR_THEME[t].map(id => [id, t] as const)),
);

export function themeDe(id: string): Theme | undefined {
  return THEME_DU_PROBLEME[id];
}

/**
 * Thèmes travaillés par chaque leçon du chapitre « Les bases ». Une leçon sans thème n'a pas de série :
 * la banque n'a encore aucun problème de ko (l4), de territoire et d'ouverture (l6) ni de comptage (l7).
 * La leçon 3 enseigne trois pièges : sa série en prend un de chaque.
 */
export const THEMES_DE_LECON: Readonly<Record<string, readonly Theme[]>> = {
  l1: ['capture'],
  l2: ['atari'],
  l3: ['double-atari', 'bord', 'echelle'],
  l5: ['vie-mort'],
};

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
  const themes = THEMES_DE_LECON[lecon] ?? [];
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
