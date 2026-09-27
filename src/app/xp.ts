// Progression (issue #109) : points d'expérience (XP), niveaux et récompenses cosmétiques, gardés sur l'appareil.
// Règles tirées de la skill gamification-patterns (anti-patterns) :
// - on ne perd jamais d'XP, il n'y a ni minuteur ni pénalité ;
// - les gains récompensent un effort réel (problème réussi une première fois, leçon terminée, partie menée au bout) ;
// - les récompenses sont purement cosmétiques, rien ne s'achète ;
// - le coût d'un niveau est plafonné : la progression ne devient jamais une corvée sans fin.
import { EVENTS, track } from '../data/analytics';

export type SourceXp = 'probleme' | 'goDuJour' | 'lecon' | 'partie' | 'victoire';

/** XP gagnés par source. Une victoire compte la partie terminée (+15) et le bonus de victoire (+25). */
export const GAINS: Record<SourceXp, number> = { probleme: 10, goDuJour: 20, lecon: 30, partie: 15, victoire: 40 };

/**
 * Courbe des niveaux. On commence au niveau 1 avec 0 XP.
 * Passer du niveau n au niveau n + 1 coûte `cout(n) = min(PLAFOND, arrondi5(100 × 1,25^(n − 1)))` XP :
 * 100, 125, 155, 195, 245, 305, 380, 475, 595, 745, 930, puis 1000 par niveau.
 * Le niveau 2 arrive donc à 100 XP (environ 7 problèmes, ou 3 leçons), le niveau 3 à 225, le niveau 5 à 575.
 */
export const BASE = 100;
export const RAISON = 1.25;
export const PLAFOND = 1000;

export function cout(niveau: number): number {
  return Math.min(PLAFOND, Math.round((BASE * RAISON ** (niveau - 1)) / 5) * 5);
}

/** XP total nécessaire pour atteindre un niveau (niveau 1 : 0). */
export function seuil(niveau: number): number {
  let s = 0;
  for (let n = 1; n < niveau; n++) s += cout(n);
  return s;
}

export interface Niveau {
  niveau: number;
  /** XP gagnés depuis le début du niveau. */
  dans: number;
  /** XP à gagner dans ce niveau pour passer au suivant. */
  besoin: number;
}

export function niveauDe(xp: number): Niveau {
  let niveau = 1, reste = Math.max(0, Math.floor(xp));
  while (reste >= cout(niveau)) { reste -= cout(niveau); niveau++; }
  return { niveau, dans: reste, besoin: cout(niveau) };
}

export interface Recompense { niveau: number; id: 'kaya-clair' | 'ardoise' | 'coquillage-dore'; nom: string; genre: 'goban' | 'pierres' }
/** Récompenses cosmétiques, débloquées par niveau. Elles se choisissent dans le Profil (thème du goban, src/ui/boardArt.ts). */
export const RECOMPENSES: readonly Recompense[] = [
  { niveau: 3, id: 'kaya-clair', nom: 'Kaya clair', genre: 'goban' },
  { niveau: 5, id: 'ardoise', nom: 'Ardoise', genre: 'goban' },
  { niveau: 8, id: 'coquillage-dore', nom: 'Coquillage doré', genre: 'pierres' },
];

export const libelleRecompense = (r: Recompense) => `${r.genre === 'goban' ? 'le goban' : 'les pierres'} « ${r.nom} »`;
export const recompenseDuNiveau = (niveau: number) => RECOMPENSES.find(r => r.niveau === niveau);
export const prochaineRecompense = (niveau: number) => RECOMPENSES.find(r => r.niveau > niveau);
/** Niveau requis pour un thème du goban : 1 pour le kaya par défaut. */
export const niveauRequis = (id: string) => RECOMPENSES.find(r => r.id === id)?.niveau ?? 1;
export const themeDebloque = (id: string, niveau: number) => niveau >= niveauRequis(id);
export const recompensesDebloquees = (niveau: number) => RECOMPENSES.filter(r => r.niveau <= niveau);

export interface Gain { source: SourceXp; points: number; avant: number; apres: number; niveauAvant: number; niveauApres: number }

/** Calcul pur d'un gain : jamais négatif. */
export function appliquer(xp: number, source: SourceXp): Gain {
  const avant = Math.max(0, Math.floor(xp) || 0), points = GAINS[source], apres = avant + points;
  return { source, points, avant, apres, niveauAvant: niveauDe(avant).niveau, niveauApres: niveauDe(apres).niveau };
}

// --- Stockage sur l'appareil et diffusion aux écrans ---

export const XP_KEY = 'go.xp.v1';

export function lireXp(): number {
  try {
    const v = Number(JSON.parse(localStorage.getItem(XP_KEY) || '0'));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch { return 0; }
}

type Ecouteur = (g: Gain) => void;
const ecouteurs = new Set<Ecouteur>();
/** S'abonne aux gains (barre de l'accueil, célébration de niveau). Renvoie la fonction de désabonnement. */
export function abonnerXp(fn: Ecouteur): () => void {
  ecouteurs.add(fn);
  return () => { ecouteurs.delete(fn); };
}

// `xp_gagne` est agrégé : les gains rapprochés (quelques secondes) partent en un seul événement.
export const DELAI_AGREGAT_MS = 4000;
let agregat: { points: number; gains: number; sources: Set<SourceXp> } | null = null;
let minuterie: ReturnType<typeof setTimeout> | null = null;

export function envoyerAgregat(): void {
  if (minuterie) { clearTimeout(minuterie); minuterie = null; }
  if (!agregat) return;
  const a = agregat;
  agregat = null;
  const xp = lireXp();
  track(EVENTS.xpGagne, { points: a.points, gains: a.gains, sources: [...a.sources].sort().join(','), xp_total: xp, niveau: niveauDe(xp).niveau });
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', envoyerAgregat);

/**
 * Crédite l'XP d'une action terminée. Un seul appel par endroit où `track` envoie déjà l'événement correspondant.
 * Envoie `niveau_atteint` à chaque niveau franchi et prévient les écouteurs.
 */
export function gagnerXp(source: SourceXp): Gain {
  const g = appliquer(lireXp(), source);
  try { localStorage.setItem(XP_KEY, JSON.stringify(g.apres)); } catch { /* stockage indisponible : le gain reste affiché pour la session */ }
  agregat ??= { points: 0, gains: 0, sources: new Set() };
  agregat.points += g.points; agregat.gains++; agregat.sources.add(source);
  if (minuterie) clearTimeout(minuterie);
  minuterie = setTimeout(envoyerAgregat, DELAI_AGREGAT_MS);
  for (let n = g.niveauAvant + 1; n <= g.niveauApres; n++) track(EVENTS.niveauAtteint, { niveau: n, xp_total: g.apres, source, recompense: recompenseDuNiveau(n)?.id });
  ecouteurs.forEach(fn => fn(g));
  return g;
}
