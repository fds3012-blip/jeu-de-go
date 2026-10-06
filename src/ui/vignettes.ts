// Positions des vignettes des leçons (chemin Apprendre, v3) : une mini-position de go par leçon, sur une grille 4 × 4.
// Dessinées par src/ui/VignetteLecon.tsx ; vérifiées par src/ui/VignetteLecon.test.tsx (toutes distinctes, sur la grille).

/** Colonne et rangée sur la grille 4 × 4 (0 en haut à gauche). */
export type Point = [number, number];

export interface Motif {
  /** Pierres noires (ardoise). */
  noir?: Point[];
  /** Pierres blanches (coquillage). */
  blanc?: Point[];
  /** Point à jouer, en jade. */
  jade?: Point[];
  /** Point précieux (œil, point vital), cerclé d'or. */
  or?: Point[];
  /** Cases de territoire, en jade ou en or. */
  cases?: { couleur: 'jade' | 'or'; points: Point[] };
  /** Bord du goban dessiné en bas et à gauche (coin). */
  coin?: boolean;
  /** Points hoshi (repères du coin). */
  hoshi?: Point[];
}

/**
 * Une position par leçon, choisie pour dire la notion en un coup d'œil.
 * Les identifiants suivent content/lessons.fr.js ; une leçon sans motif reçoit une pierre seule.
 */
export const MOTIFS: Record<string, Motif> = {
  // Libertés et capture : une pierre blanche prise entre trois noires, la dernière liberté en jade.
  l1: { noir: [[1, 0], [0, 1], [1, 2]], blanc: [[1, 1]], jade: [[2, 1]] },
  // Atari : une pierre noire qu'on sauve en s'étendant vers le jade.
  l2: { blanc: [[1, 0], [0, 1], [1, 2]], noir: [[1, 1]], jade: [[2, 1]] },
  // Techniques de capture : l'échelle, qui descend en escalier.
  l3: { noir: [[0, 0], [1, 1], [2, 2]], blanc: [[1, 0], [2, 1]], jade: [[3, 2]] },
  // Le ko : les deux pierres qui se prennent et se reprennent.
  l4: { noir: [[1, 0], [0, 1], [1, 2]], blanc: [[2, 0], [2, 1], [3, 1], [2, 2]], jade: [[1, 1]] },
  // Vivre et mourir : un groupe noir avec ses deux yeux, cerclés d'or.
  l5: { noir: [[1, 0], [2, 0], [0, 1], [2, 1], [3, 1], [0, 2], [1, 2], [3, 2], [1, 3], [2, 3]], or: [[1, 1], [2, 2]] },
  // Territoire et ouverture : une pierre au 3-3, le coin qu'elle entoure.
  l6: { coin: true, noir: [[1, 1]], cases: { couleur: 'jade', points: [[0, 2], [0, 3], [1, 3], [1, 2]] } },
  // Compter les points : une frontière fermée, le territoire noir compté.
  l7: { noir: [[1, 0], [1, 1], [1, 2], [1, 3]], blanc: [[2, 0], [2, 1], [2, 2], [2, 3]], cases: { couleur: 'or', points: [[0, 0], [0, 1], [0, 2], [0, 3]] } },
  // Les premiers coups : le coin, ses repères, la pierre noire posée au 3-3.
  l8: { coin: true, hoshi: [[2, 1]], noir: [[1, 2]], blanc: [[3, 0]], jade: [[2, 1]] },
  // Le filet : la pierre blanche enfermée sans la toucher.
  l9: { blanc: [[1, 1]], noir: [[0, 1], [1, 0]], jade: [[2, 2]] },
  // La prise en retour : une pierre donnée dans le trou pour en reprendre deux.
  l10: { blanc: [[1, 1], [2, 1]], noir: [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [2, 2]], jade: [[1, 2]] },
  // La course aux libertés : deux groupes face à face, chacun ses libertés.
  l11: { blanc: [[1, 1], [2, 1]], noir: [[1, 2], [2, 2]], jade: [[0, 1], [3, 1]] },
  // Le faux œil : l'œil du bas ne tient que par un coin, et ce coin est blanc.
  l12: { coin: true, noir: [[0, 2], [2, 2], [1, 1], [2, 1]], blanc: [[0, 1], [3, 2], [3, 1]], or: [[1, 2]] },
  // Le point vital : un espace de trois points dans le groupe blanc ; le milieu, en jade, décide.
  l13: { blanc: [[0, 1], [1, 1], [2, 1], [3, 2], [0, 3], [1, 3], [2, 3]], jade: [[1, 2]] },
  // Le seki : deux groupes face à face et leurs deux libertés partagées (en or) que personne ne peut prendre.
  l14: { noir: [[0, 0], [0, 1], [0, 2], [1, 1]], blanc: [[2, 0], [2, 1], [2, 2], [3, 1]], or: [[1, 0], [1, 2]] },
  // Finir la partie : la frontière a un trou ; le fermer, en jade, avant de passer.
  l15: { noir: [[1, 0], [1, 1], [1, 3]], blanc: [[2, 0], [2, 1], [2, 2], [2, 3]], jade: [[1, 2]] },
  // Compter une partie : le territoire noir compté, avec une pierre blanche morte dedans.
  l16: { noir: [[1, 0], [1, 1], [1, 2], [1, 3]], blanc: [[0, 1], [2, 0], [2, 1], [2, 2], [2, 3]], cases: { couleur: 'or', points: [[0, 0], [0, 2], [0, 3]] } },
  // Les formes d'yeux : un espace en T dans le groupe noir ; son centre, en jade, décide.
  l17: { noir: [[0, 2], [2, 2], [1, 1], [3, 3]], jade: [[1, 3]] },
  // Les bonnes formes : la bouche du tigre, trois pierres autour du point où Blanc serait aussitôt en atari.
  l18: { noir: [[0, 1], [2, 1], [1, 2]], blanc: [[2, 2]], jade: [[1, 1]] },
  // Les pierres qui coupent : la pierre blanche entre trois noires, et la quatrième qui la prend en jade.
  l19: { noir: [[1, 0], [0, 1], [2, 1]], blanc: [[1, 1], [3, 3]], jade: [[1, 2]] },
  // Relier et mourir : la chaîne blanche et sa pierre en atari ; relier ne lui laisse qu'une liberté.
  l20: { noir: [[0, 1], [1, 1], [2, 1], [3, 2]], blanc: [[0, 2], [1, 2], [2, 2], [3, 3]], jade: [[2, 3]] },
  // Le manque de libertés : deux chaînes blanches qui ne se relient qu'en se mettant en atari ; le jade, la liberté extérieure.
  l21: { coin: true, noir: [[0, 1], [1, 1], [2, 1], [3, 1], [2, 2]], blanc: [[0, 3], [1, 2], [1, 3], [2, 3]], jade: [[3, 3]] },
  // Sente et gote : l'atari qui oblige Blanc à relier ; le jade, la réponse forcée.
  l22: { coin: true, noir: [[0, 2], [1, 2], [2, 2]], blanc: [[1, 3], [2, 3], [3, 2]], jade: [[3, 3]] },
  // Le hane au premier rang : la pierre noire contourne la pierre blanche par en dessous.
  l23: { coin: true, noir: [[0, 2], [1, 2], [2, 3]], blanc: [[2, 2], [3, 2]], jade: [[1, 3]] },
  // Agrandir ou réduire : le groupe noir sur le bord, et le point qui finit son espace, en jade.
  l24: { coin: true, noir: [[0, 2], [1, 2], [2, 2], [1, 3]], blanc: [[0, 1], [1, 1], [2, 1], [3, 1], [3, 3]], jade: [[2, 3]] },
  // Les groupes du coin : le point du coin, en jade, à côté du groupe noir.
  l25: { coin: true, noir: [[1, 2], [2, 2], [3, 2], [1, 3]], blanc: [[0, 1], [1, 1], [2, 1]], jade: [[0, 2]] },
  // La course avec un œil : le groupe noir et son œil dans le coin, en or ; le jade, une liberté du dehors.
  l26: { coin: true, noir: [[0, 2], [1, 2], [2, 2], [1, 3]], blanc: [[3, 2], [3, 3]], or: [[0, 3]], jade: [[3, 1]] },
};
