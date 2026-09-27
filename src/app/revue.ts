// Revue d'une partie terminée (issue #34) : logique pure, testée dans revue.test.ts.
// La partie est gardée en SGF dans localStorage (clé REVUE_KEY) ; l'écran src/app/Revue.tsx la relit,
// estime l'avance de Noir après chaque coup, puis montre les plus grosses erreurs du joueur.
import { newPosition, play, type Color, type Position } from '../go/rules';
import { readSgf, writeSgf } from '../go/sgf';
import { toLabel } from '../go/coords';

/** Dernière partie terminée, pour la revue (localStorage ; Supabase viendra plus tard). */
export const REVUE_KEY = 'go.revue.v1';

export interface PartieGardee { sgf: string; adversaire?: string; date: string }

/** SGF de la partie, tiré de l'historique des positions (Noir commence, `tt` = passe). */
export function sgfDepuisHistorique(history: Position[], komi: number, noms: { noir?: string; blanc?: string } = {}): string {
  const size = history[0].size;
  const moves: { color: Color; p: number }[] = [];
  for (let i = 1; i < history.length; i++) moves.push({ color: history[i - 1].toPlay, p: history[i].lastMove ?? -1 });
  return writeSgf({ size, komi, rules: 'japanese', black: noms.noir, white: noms.blanc, setupBlack: [], setupWhite: [], moves });
}

/** Positions successives rejouées depuis le SGF (index 0 : plateau vide). S'arrête au premier coup illégal. */
export function positionsDepuisSgf(sgf: string): { positions: Position[]; komi: number } {
  const g = readSgf(sgf);
  const positions: Position[] = [newPosition(g.size)];
  for (const m of g.moves) {
    const cur = positions[positions.length - 1];
    const r = play(m.color === cur.toPlay ? cur : { ...cur, toPlay: m.color, ko: -1 }, m.p);
    if (typeof r === 'string') break;
    positions.push(r);
  }
  return { positions, komi: g.komi };
}

export interface Erreur {
  /** Numéro du coup fautif (1 = premier coup) : il mène de la position `coup - 1` à la position `coup`. */
  coup: number;
  /** Points perdus par ce coup (> 0). */
  perte: number;
}

/**
 * Les `n` plus grosses erreurs de `joueur` : les plus fortes chutes de son avance après un de ses coups.
 * `avances[i]` : avance de Noir (points, komi compris) dans la position i ; `null` si inconnue.
 * Une chute de moins de `seuil` points n'est pas une erreur (bruit de l'estimation). Triées de la plus grosse à la plus petite.
 */
export function grossesErreurs(positions: Position[], avances: (number | null)[], joueur: Color | null, n = 3, seuil = 1.5): Erreur[] {
  const out: Erreur[] = [];
  for (let i = 1; i < positions.length && i < avances.length; i++) {
    const avant = avances[i - 1], apres = avances[i], c = positions[i - 1].toPlay;
    if (avant == null || apres == null || (joueur && c !== joueur)) continue;
    const perte = c === 1 ? avant - apres : apres - avant;
    if (perte >= seuil) out.push({ coup: i, perte });
  }
  return out.sort((a, b) => b.perte - a.perte || a.coup - b.coup).slice(0, n);
}

const pts = (n: number) => { const v = Math.max(1, Math.round(n)); return `${v} point${v > 1 ? 's' : ''}`; };

/** Phrase de Mochi pour une erreur : courte, au tutoiement, sans jargon. `meilleur` : coup conseillé (-1 : passer). */
export function phraseErreur(e: Erreur, positions: Position[], meilleur: number | null): string {
  const avant = positions[e.coup - 1], apres = positions[e.coup], size = avant.size;
  const joue = apres.lastMove ?? -1, c = avant.toPlay, adv = (3 - c) as Color;
  const perdues = positions[e.coup + 1] ? positions[e.coup + 1].captures[adv] - apres.captures[adv] : 0;
  const conseil = meilleur == null ? '' : meilleur < 0 ? ' Ici, il valait mieux passer.' : ` Essaie plutôt ${toLabel(meilleur, size)}, la pierre verte.`;
  let constat: string;
  if (joue < 0) constat = `Tu passes trop tôt : il restait environ ${pts(e.perte)} à prendre.`;
  else if (perdues > 0) constat = `Après ${toLabel(joue, size)}, l'adversaire capture ${perdues > 1 ? `${perdues} pierres` : 'une pierre'}. Tu perds environ ${pts(e.perte)}.`;
  else if (e.perte >= 10) constat = `${toLabel(joue, size)} coûte cher : environ ${pts(e.perte)}.`;
  else constat = `${toLabel(joue, size)} laisse filer environ ${pts(e.perte)}.`;
  return constat + conseil;
}

/**
 * Historique pour « Rejouer d'ici » : on reprend juste avant le coup `coup`, à un moment où `joueur` a le trait
 * (contre l'ordi, tu rejoues toujours Noir). Renvoie au moins le plateau de départ.
 */
export function rejouerDici(positions: Position[], coup: number, joueur: Color | null): Position[] {
  let i = Math.max(0, Math.min(coup - 1, positions.length - 1));
  if (joueur) while (i > 0 && positions[i].toPlay !== joueur) i--;
  return positions.slice(0, i + 1);
}

/** Tracé SVG de la courbe d'avantage : Noir en bas, Blanc en haut. Une avance de Noir fait monter la courbe. */
export function courbe(avances: (number | null)[], largeur: number, hauteur: number, size: number): { ligne: string; aire: string } {
  const n = avances.length;
  if (n === 0) return { ligne: '', aire: '' };
  const echelle = size * 1.5;
  const y = (v: number) => hauteur / 2 - (hauteur / 2) * Math.tanh(v / echelle) * 0.94;
  const x = (i: number) => (n === 1 ? largeur / 2 : (i * largeur) / (n - 1));
  let dernier = 0;
  const pts: string[] = [];
  avances.forEach((v, i) => { if (v != null) dernier = v; pts.push(`${x(i).toFixed(1)} ${y(dernier).toFixed(1)}`); });
  const ligne = `M${pts.join('L')}`;
  return { ligne, aire: `${ligne}L${x(n - 1).toFixed(1)} ${hauteur}L${x(0).toFixed(1)} ${hauteur}Z` };
}
