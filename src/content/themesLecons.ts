// Thèmes des problèmes (issue #200) : la liste des thèmes et ceux de chaque leçon.
// #563 : à part de src/content/themes.ts (thème de chaque problème, série de fin de leçon), pour que l'accueil, qui ne
// lit que THEMES_DE_LECON, n'emporte pas la liste des problèmes par thème. themes.ts réexporte ce module.

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
  | 'prise-en-retour'
  /** Seki (vie commune) : deux groupes sans deux yeux partagent leurs libertés ; celui qui en remplit une meurt. */
  | 'seki'
  /** Finir la partie : fermer les frontières au contact, laisser la dame (point neutre), ne pas prendre une morte. */
  | 'fin-de-partie'
  /** Compter : territoire, prisonniers et pierres mortes, komi ; la dame et les points d'un seki ne comptent pas. */
  | 'comptage'
  /** Ko : prendre un ko, le fermer (relier), le prendre pour sauver ses pierres ; la reprise immédiate est interdite. */
  | 'ko'
  /** Ouverture : le coin libre d'abord, sur la 3e ou la 4e ligne (3-3, 3-4, 4-4). En 13 × 13, vérifié par KataGo. */
  | 'ouverture';

export const THEMES: readonly Theme[] = [
  'capture', 'atari', 'double-atari', 'bord', 'echelle', 'filet', 'relier-couper', 'vie-mort', 'semeai', 'prise-en-retour',
  'seki', 'fin-de-partie', 'comptage', 'ko', 'ouverture',
];

/**
 * Thèmes travaillés par chaque leçon. Une leçon sans thème n'a pas de série.
 * La leçon 3 enseigne trois pièges : sa série en prend un de chaque. Les leçons 6 (territoire et ouverture) et 7
 * (fermer, passer, compter) en ont deux chacune.
 */
export const THEMES_DE_LECON: Readonly<Record<string, readonly Theme[]>> = {
  l1: ['capture'],
  l2: ['atari'],
  l3: ['double-atari', 'bord', 'echelle'],
  // #16, lot X : le ko (l4) a sa série ; territoire et ouverture (l6) mêlent l'ouverture et le comptage ; compter les
  // points (l7) reprend la fin de partie et le comptage du lot W (fermer une frontière, remplir la dame, le komi) ;
  // les premiers coups (l8) ont la série d'ouverture.
  l4: ['ko'],
  l5: ['vie-mort'],
  l6: ['ouverture', 'comptage'],
  l7: ['fin-de-partie', 'comptage'],
  l8: ['ouverture'],
  // #16 : chaque nouvelle leçon a la série de son thème (filet, prise en retour, course aux libertés, faux œil).
  l9: ['filet'],
  l10: ['prise-en-retour'],
  l11: ['semeai'],
  l12: ['vie-mort'],
  // #16 : le point vital (l13) a la série de vie et mort. Le seki (l14), finir la partie (l15) et compter (l16) ont
  // chacun la leur, avec le lot W.
  l13: ['vie-mort'],
  l14: ['seki'],
  l15: ['fin-de-partie'],
  l16: ['comptage'],
  // #16 (05/10) : les formes d'yeux (l17) ont la série de vie et mort ; les bonnes formes (l18) et les pierres qui
  // coupent (l19) celle de relier et couper ; relier et mourir (l20), la capture.
  l17: ['vie-mort'],
  l18: ['relier-couper'],
  l19: ['relier-couper'],
  l20: ['capture'],
  // #16 (palier 21-30) : le manque de libertés (l21) a la série de capture, comme relier et mourir.
  l21: ['capture'],
  // #16 (palier 21-30) : sente et gote (l22) et le hane au premier rang (l23) ont la série de fin de partie.
  l22: ['fin-de-partie'],
  // Le hane au premier rang : la même série que sente et gote.
  l23: ['fin-de-partie'],
  // Agrandir ou réduire (l24) : la série de vie et mort ; les groupes du coin (l25) y ajoutent le ko.
  l24: ['vie-mort'],
  // Les groupes du coin : vie et mort, et le ko.
  l25: ['vie-mort', 'ko'],
  // #16 (palier 21-30) : la course avec un œil (l26) a la série de course aux libertés.
  l26: ['semeai'],
  // #16 (palier 27-30) : attaquer et défendre (l27) ferme la sortie vers le centre (série du bord), en début de partie.
  l27: ['bord', 'ouverture'],
  // #16 : l'ouverture en 13 × 13 (l29) et les joseki (l30, l31) ont la série d'ouverture (lot X, coins libres en 13 × 13).
  l29: ['ouverture'],
  l30: ['ouverture'],
  l31: ['ouverture'],
  // #16 (leçons 32 et suivantes) : la valeur d'un coup (l32) a la série de fin de partie.
  l32: ['fin-de-partie'],
  // Le sente avant le gote (l33) : la série de fin de partie.
  l33: ['fin-de-partie'],
  // Relier par en dessous (l34) : la série de relier et couper.
  l34: ['relier-couper'],
  // Couper par en dessous (l35) : la même série.
  l35: ['relier-couper'],
  // Couper, puis reprendre (l36) : relier et couper, et la prise en retour.
  l36: ['relier-couper', 'prise-en-retour'],
  // #539 : les points miai (l37).
  l37: ['vie-mort'],
  // #539 : jouer ailleurs (l38).
  l38: ['fin-de-partie'],
  // #539 : les libertés communes (l39).
  l39: ['semeai'],
  // #539 : les yeux dans la course (l40).
  l40: ['semeai'],
  // #547 : compter en règle chinoise (l41) reprend la série de comptage ; lire l'échelle (l42), celle de l'échelle ;
  // le triangle vide (l43), relier et couper (garder ses pierres solides) ; le deuxième rang (l44), vie et mort.
  l41: ['comptage'],
  l42: ['echelle'],
  l43: ['relier-couper'],
  l44: ['vie-mort'],
  // #547 : les menaces de ko (l45), la série du ko.
  l45: ['ko'],
  // #547 : le handicap (l46), la série d'ouverture (où poser ses premières pierres).
  l46: ['ouverture'],
  // #553 : le mur (l47) et envahir ou réduire (l49), la série d'ouverture ; couper et relier (l48), relier et couper.
  l47: ['ouverture'],
  l48: ['relier-couper'],
  l49: ['ouverture'],
  // #672 : les ouvertures célèbres (nirensei, sanrensei, shin-fuseki, chinois, kosumi de Shusaku, approche du hoshi,
  // san-san d'AlphaGo), la série d'ouverture.
  l50: ['ouverture'], l51: ['ouverture'], l52: ['ouverture'], l53: ['ouverture'], l54: ['ouverture'], l55: ['ouverture'], l56: ['ouverture'],
};
