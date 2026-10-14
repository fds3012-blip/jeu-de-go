// Reprise d'une partie interrompue contre l'ordi (#528, reprend #15) : fermeture de l'onglet, mise en veille, rechargement.
// L'écran de partie garde la partie à chaque coup (SGF : pierres de handicap, komi et règle compris) ; l'accueil propose
// « Reprendre ta partie contre Caillou » tant qu'elle n'est ni finie, ni quittée (« Quitter » : elle est perdue), ni
// remplacée par une nouvelle partie contre l'ordi. Module léger (JS initial) : l'accueil ne lit que les métadonnées,
// le SGF n'est relu que par l'écran de partie (src/app/revue.ts, positionsDepuisSgf).
import type { Rules } from '../go/score';

export const PARTIE_EN_COURS_KEY = 'go.partie.encours.v1';
/** Au-delà, la partie n'est plus proposée (elle est oubliée à la lecture suivante). */
export const DUREE_REPRISE_MS = 14 * 24 * 3600 * 1000;

export interface PartieEnCours {
  v: 1;
  /** Partie au format SGF : HA et AB pour le handicap, KM (komi de la partie), RU (règle de comptage). */
  sgf: string;
  /** Adversaire de l'échelle (identifiant, jamais un nom saisi). */
  adversaire: string;
  taille: 9 | 13 | 19;
  /** Komi compté et komi vu par l'ordi (ils diffèrent seulement avec le paramètre de test `?komi=`). */
  komi: number;
  aiKomi: number;
  regles: Rules;
  handicap: number;
  /** Équilibrage de la partie au moment où elle a commencé (src/app/equilibrage.ts). */
  avantage: boolean;
  accommodant: boolean;
  /** Coups joués (les deux camps). */
  coups: number;
  /** Date du dernier coup gardé (ISO). */
  date: string;
}

const nombre = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Partie gardée, ou null si elle est absente, abîmée, trop ancienne ou d'un adversaire inconnu (`connus`). */
export function lirePartieEnCours(brut: unknown, connus: readonly string[], maintenant = Date.now()): PartieEnCours | null {
  if (!brut || typeof brut !== 'object') return null;
  const p = brut as Partial<PartieEnCours>;
  if (p.v !== 1 || typeof p.sgf !== 'string' || !p.sgf.startsWith('(') || typeof p.adversaire !== 'string' || !connus.includes(p.adversaire)) return null;
  if (p.taille !== 9 && p.taille !== 13 && p.taille !== 19) return null;
  if (!nombre(p.komi) || !nombre(p.aiKomi) || !nombre(p.coups) || p.coups < 1 || !nombre(p.handicap)) return null;
  if (p.regles !== 'japanese' && p.regles !== 'chinese') return null;
  const t = typeof p.date === 'string' ? Date.parse(p.date) : NaN;
  if (!Number.isFinite(t) || maintenant - t > DUREE_REPRISE_MS) return null;
  return { v: 1, sgf: p.sgf, adversaire: p.adversaire, taille: p.taille, komi: p.komi, aiKomi: p.aiKomi, regles: p.regles, handicap: p.handicap,
    avantage: p.avantage !== false, accommodant: p.accommodant === true, coups: Math.floor(p.coups), date: p.date as string };
}

export function lirePartieEnCoursAppareil(connus: readonly string[], maintenant = Date.now()): PartieEnCours | null {
  try { return lirePartieEnCours(JSON.parse(localStorage.getItem(PARTIE_EN_COURS_KEY) ?? 'null'), connus, maintenant); } catch { return null; }
}

export function garderPartieEnCours(p: PartieEnCours): void {
  try { localStorage.setItem(PARTIE_EN_COURS_KEY, JSON.stringify(p)); } catch { /* stockage plein ou indisponible : pas de reprise */ }
}

export function oublierPartieEnCours(): void {
  try { localStorage.removeItem(PARTIE_EN_COURS_KEY); } catch { /* stockage indisponible */ }
}
