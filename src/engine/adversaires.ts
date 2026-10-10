// Adversaires de l'échelle : identité, phrase, réglages du moteur simple et de KataGo.
// Module à part, sans le moteur (#513) : l'accueil (src/app/App.tsx, src/engine/guidee.ts) en a besoin dès le
// chargement initial ; le moteur simple (simple.ts, Monte-Carlo, filtre d'ouverture, pierres mortes) arrive avec la partie.
export type OpponentId = 'pomme' | 'caillou' | 'bambou' | 'renard' | 'riviere' | 'tigre' | 'montagne' | 'dragon' | 'sensei';

/** Style de jeu des niveaux KataGo : il oriente le choix parmi les coups jugés acceptables. */
export type Style = 'agressif' | 'solide' | 'territorial';

export interface KataGoLevel {
  visits: number; // visites de la recherche PUCT
  tolerance: number; // points de perte acceptés par rapport au meilleur coup
  style: Style;
  /**
   * Température du tirage au hasard (champ `hasard` du niveau) : le coup est tiré selon la politique du réseau
   * élevée à la puissance 1 / température. 1 = la politique telle quelle ; plus haut, des coups moins probables.
   */
  temperature?: number;
}

export interface Opponent {
  id: OpponentId;
  nom: string;
  rang: string;
  description: string;
  /** Phrase de personnage, courte et au tutoiement, affichée sous le nom à l'accueil. */
  phrase: string;
  // Moteur simple (Pomme, Caillou, et repli des niveaux KataGo si le réseau ne se charge pas).
  playouts: number; // plafond de simulations par coup
  timeMs: number; // budget de temps par coup
  /**
   * Probabilité de jouer un coup au hasard au lieu du meilleur. Moteur simple : un candidat uniforme.
   * Niveaux KataGo : un coup tiré selon la politique du réseau (voir `KataGoLevel.temperature`), jamais dans
   * ses propres yeux ni en auto-atari.
   */
  hasard: number;
  heuristiques: boolean; // priorité aux captures et aux sauvetages
  /** Ne passe pas tant qu'une frontière reste ouverte : il la ferme d'abord (#159). */
  fermeFrontieres?: boolean;
  /**
   * Coups plausibles seulement (#488, src/engine/ouverture.ts) : 3e–4e ligne à l'ouverture, pas de 1re ligne sans raison.
   * Absent ou vrai : actif. `false` : ancien comportement (sert de témoin aux mesures).
   */
  ouverture?: boolean;
  /**
   * Parties accommodantes (#235) : après la passe du joueur, ferme une brèche de sa frontière. Absent ou vrai : oui.
   * `false` (Pomme, #488) : elle passe toujours quand tu passes. Depuis le filtre des coups plausibles, elle laisse plus
   * souvent un trou au bord de sa zone ; le fermer après ta passe lui rapportait 9,3 points en moyenne au 40e coup.
   */
  fermeBreche?: boolean;
  /** Présent : ce niveau joue avec KataGo (réseau g170-b6c96). */
  katago?: KataGoLevel;
}

// Repli commun des niveaux KataGo : le moteur simple à pleine force (niveau Caillou).
const repli = { playouts: 20000, timeMs: 800, hasard: 0, heuristiques: true, fermeFrontieres: true } as const;

/**
 * Échelle des défis, du plus facile au plus fort. Bambou et Renard jouent une partie de leurs coups selon la
 * politique du réseau (`hasard`, `temperature`, #179) : sans ça, Bambou écrase Caillou de 71 points sur 81.
 * Mesures : docs/game-design/equilibrage.md.
 */
export const OPPONENTS: Opponent[] = [
  // Pomme : hasard 0,65 depuis #488 (0,3 avant). Le filtre des coups plausibles (ouverture.ts) lui retire ses pires coups ;
  // ce hasard plus haut la garde aussi battable qu'avant. Et elle passe toujours quand tu passes en début de parcours
  // (`fermeBreche: false`) : docs/game-design/ouverture-pomme-2026-10-08.md.
  { id: 'pomme', nom: 'Pomme', rang: '20 kyu', phrase: 'Elle apprend comme toi.', description: 'Joue un peu au hasard. Parfait pour ta première partie.', playouts: 250, timeMs: 150, hasard: 0.65, heuristiques: false, fermeFrontieres: true, fermeBreche: false },
  { id: 'caillou', nom: 'Caillou', rang: '16 kyu', phrase: 'Il capture tout ce qui traîne.', description: 'Capture dès que tu le laisses faire. Protège bien tes pierres.', playouts: 20000, timeMs: 600, hasard: 0, heuristiques: true, fermeFrontieres: true },
  { id: 'bambou', nom: 'Bambou', rang: '13 kyu', phrase: 'Il plie, mais ne rompt jamais.', description: 'Joue solide et relie ses pierres. Cherche ses points faibles.', ...repli, hasard: 0.7, katago: { visits: 4, tolerance: 12, style: 'solide', temperature: 1.5 } },
  { id: 'renard', nom: 'Renard', rang: '10 kyu', phrase: "Il coupe dès que tu t’étires trop.", description: 'Aime couper et attaquer. Garde tes groupes bien reliés.', ...repli, hasard: 0.35, katago: { visits: 8, tolerance: 8, style: 'agressif', temperature: 1.5 } },
  { id: 'riviere', nom: 'Rivière', rang: '7 kyu', phrase: 'Elle se faufile le long des bords.', description: 'Prend les coins et les bords. Ne la laisse pas tout entourer.', ...repli, katago: { visits: 16, tolerance: 5, style: 'territorial' } },
  { id: 'tigre', nom: 'Tigre', rang: '5 kyu', phrase: 'Il attaque sans jamais lâcher.', description: 'Attaque sans relâche. Fais vivre tes groupes tôt.', ...repli, katago: { visits: 32, tolerance: 3, style: 'agressif' } },
  { id: 'montagne', nom: 'Montagne', rang: '3 kyu', phrase: 'Elle ne bouge pas, et ne cède rien.', description: 'Très solide, presque sans faute. Il faut la battre aux points.', ...repli, katago: { visits: 64, tolerance: 1.5, style: 'solide' } },
  { id: 'dragon', nom: 'Dragon', rang: '1 kyu', phrase: 'Il compte chaque point, même les tiens.', description: 'Compte très bien son territoire. Chaque point compte.', ...repli, katago: { visits: 128, tolerance: 0.8, style: 'territorial' } },
  { id: 'sensei', nom: 'Sensei', rang: '1 dan', phrase: 'Il a tout vu. Montre-lui ton go.', description: 'Le dernier défi. Joue son meilleur coup à chaque fois.', ...repli, katago: { visits: 200, tolerance: 0, style: 'solide' } },
];

export function opponent(id: OpponentId): Opponent {
  return OPPONENTS.find(o => o.id === id) ?? OPPONENTS[0];
}
