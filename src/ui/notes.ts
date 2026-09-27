// Encre des sceaux de note (issue #71). Couleurs fixes, identiques en mode Encre et Papier : le sceau porte
// son propre fond, comme les sceaux des adversaires. Contraste du symbole sur le fond vérifié par notes.test.ts.
import type { Note } from '../app/revue';

export const NOTE_ENCRE: Record<Note, { fond: string; texte: string }> = {
  brillant: { fond: '#2F9FD8', texte: '#04172A' },    // bleu lumineux, rare
  meilleur: { fond: '#3CC48E', texte: '#07231A' },    // jade
  excellent: { fond: '#3CC48E', texte: '#07231A' },   // jade
  bon: { fond: '#A5D66F', texte: '#12240A' },         // vert clair
  solide: { fond: '#A5D66F', texte: '#12240A' },      // vert clair (sans KataGo)
  imprecision: { fond: '#EFB84A', texte: '#2E1D00' }, // or
  erreur: { fond: '#EC8236', texte: '#2A1200' },      // orange
  grosse: { fond: '#C23A24', texte: '#FFF6EC' },      // hanko, un ton plus profond pour que « ?? » atteigne 4,5:1
};
