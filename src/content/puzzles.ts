// Copie locale de secours des 6 problèmes de base (table `puzzles`, owner_id null).
// Contenu identique à la base de production, relu le 27/09/2026 (SELECT en lecture seule) et à la
// migration 20260926235308_progression_problemes_lecons_badges. Utilisée hors connexion, sans compte
// (la règle RLS ne donne les problèmes qu'aux joueurs connectés) ou si la base ne répond pas.
import type { PuzzleRow } from '../data/puzzles';

export const BASE_PUZZLES: PuzzleRow[] = [
  {
    id: 'b1', size: 9, difficulty: 400, answers: ['E5'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '...X.....', '..XT.O...', '...X.....', '.........', '.........', '.........'], toPlay: 'B' },
    title: 'Capture la pierre',
    prompt: "La pierre blanche marquée n'a plus qu'une liberté. Capture-la."
  },
  {
    id: 'b2', size: 9, difficulty: 650, answers: ['E3'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '...XTX...', '.........'], toPlay: 'B' },
    title: 'Vers le bord',
    prompt: "Mets la pierre marquée en atari du bon côté pour qu'elle ne puisse plus s'échapper."
  },
  {
    id: 'b3', size: 9, difficulty: 500, answers: ['E5'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '.........', '..XT.TX..', '...X.X...', '.........', '.........', '.........'], toPlay: 'B' },
    title: 'Double atari',
    prompt: 'Un seul coup peut mettre les deux pierres marquées en atari en même temps.'
  },
  {
    id: 'b4', size: 9, difficulty: 400, answers: ['D4'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '...O.....', '..OSO....', '..O.X....', '.........', '.........', '.........'], toPlay: 'B' },
    title: 'Sauve ta pierre',
    prompt: 'Ta pierre marquée est en atari. Donne-lui des libertés.'
  },
  {
    id: 'b5', size: 9, difficulty: 750, answers: ['F6'], explanation: null,
    setup: { rows: ['.........', '.........', '....O....', '...O.....', '...OSOX..', '....OX...', '.........', '.........', '.........'], toPlay: 'B' },
    title: 'Capturer pour se sauver',
    prompt: "Ta pierre marquée est en atari, et s'allonger ne suffit pas."
  },
  {
    id: 'b6', size: 9, difficulty: 850, answers: ['F5', 'E4'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '....X....', '...XT....', '.....X...', '.........', '.........', '.........'], toPlay: 'B' },
    title: "L'échelle",
    prompt: "Mets la pierre marquée en atari pour qu'elle ne s'échappe jamais."
  }
];
