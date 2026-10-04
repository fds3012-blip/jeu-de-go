// Progression (issue #109) : points d'expérience (XP), niveaux et récompenses cosmétiques, gardés sur l'appareil.
// Règles tirées de la skill gamification-patterns (anti-patterns) :
// - on ne perd jamais d'XP, il n'y a ni minuteur ni pénalité ;
// - les gains récompensent un effort réel (problème réussi une première fois, leçon terminée, partie menée au bout) ;
// - les récompenses sont purement cosmétiques, rien ne s'achète ;
// - le coût d'un niveau est plafonné : la progression ne devient jamais une corvée sans fin.
import { EVENTS, track } from '../data/analytics';
import { t } from '../content/i18n';

export type SourceXp = 'probleme' | 'goDuJour' | 'revision' | 'lecon' | 'partie' | 'victoire' | 'erreursRejouees';

/**
 * XP gagnés par source. Une victoire compte la partie terminée (+15) et le bonus de victoire (+25).
 * Révision du jour (#233) : finie une fois par jour, elle fait vivre la série comme le Go du jour ; elle rapporte donc
 * autant que lui. Un défi du jour qui compte pour la série rapporte toujours quelque chose (docs/game-design/economie.md).
 */
// « Rejouer mes erreurs » (#428) : une séance finie rapporte comme un problème neuf, une seule fois par partie (rejouerErreurs.ts).
export const GAINS: Record<SourceXp, number> = { probleme: 10, goDuJour: 20, revision: 20, lecon: 30, partie: 15, victoire: 40, erreursRejouees: 10 };

/**
 * Courbe des niveaux. On commence au niveau 1 avec 0 XP.
 * Passer du niveau n au niveau n + 1 coûte `cout(n) = min(PLAFOND, arrondi5(100 × 1,25^(n − 1)))` XP :
 * 100, 125, 155, 195, 245, 305, 380, 475, 595, 745, 930, puis 1000 par niveau.
 * Le niveau 2 arrive donc à 100 XP (9 problèmes neufs, ou 3 leçons ; 8 problèmes avec le bonus « première fois »), le niveau 3 à 225,
 * le niveau 5 à 575, le niveau 8 à 1505. Rythme simulé sur 30 jours : docs/game-design/economie.md.
 */
/**
 * Source d'XP d'un problème réussi sans voir la réponse (#233, P1), ou `null` s'il ne rapporte rien.
 * Un problème ordinaire rapporte une seule fois : à sa première réussite.
 * Le Go du jour rapporte ses 20 XP une fois par jour, même si le joueur avait déjà réussi ce problème dans la grille :
 * c'est le défi commun du jour, il ne doit pas rapporter moins au joueur le plus assidu.
 */
export function sourceXpProbleme(o: { dejaReussi: boolean; estDuJour: boolean; goDuJourDejaFait: boolean }): SourceXp | null {
  if (o.estDuJour) return o.goDuJourDejaFait && o.dejaReussi ? null : 'goDuJour';
  return o.dejaReussi ? null : 'probleme';
}

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

/** « le goban « Kaya clair » », dans la langue de l'interface (#167). */
export const libelleRecompense = (r: Recompense) => t(r.genre === 'goban' ? 'recompense.goban' : 'recompense.pierres', { nom: t(`theme.${r.id}`) });
export const recompenseDuNiveau = (niveau: number) => RECOMPENSES.find(r => r.niveau === niveau);
export const prochaineRecompense = (niveau: number) => RECOMPENSES.find(r => r.niveau > niveau);
/** Niveau requis pour un thème du goban : 1 pour le kaya par défaut. */
export const niveauRequis = (id: string) => RECOMPENSES.find(r => r.id === id)?.niveau ?? 1;
export const themeDebloque = (id: string, niveau: number) => niveau >= niveauRequis(id);
export const recompensesDebloquees = (niveau: number) => RECOMPENSES.filter(r => r.niveau <= niveau);

/**
 * Bonus « première fois » (issue #162) : progrès offert (Nunes et Drèze, 2006). Sans lui, un parcours type de
 * 10 minutes (une partie perdue, une leçon, 2 problèmes) donnait 65 XP sur 100. Avec lui : 115, le niveau 2 tombe
 * pendant la première session. Chaque bonus ne se gagne qu'une fois par appareil.
 * #233 (C8) : le même bonus pour les trois (+20). Avec +10 pour le premier problème, le joueur de 10 minutes finissait
 * son premier jour à 100 XP pile : un seul problème « Vu » et le niveau 2 ne tombait pas (simulation : 90 XP).
 * Règle simple à dire : « chaque première fois rapporte +20 ».
 */
export type Premiere = 'partie' | 'lecon' | 'probleme';
export const BONUS_PREMIERE: Record<Premiere, number> = { partie: 20, lecon: 20, probleme: 20 };
/** Le Go du jour, la révision et les erreurs rejouées (#428) sont des problèmes ; une victoire est une partie. */
export const premiereDe = (source: SourceXp): Premiere =>
  source === 'goDuJour' || source === 'revision' || source === 'erreursRejouees' ? 'probleme' : source === 'victoire' ? 'partie' : source;

export interface Gain {
  source: SourceXp;
  /** XP gagnés au total, bonus compris. */
  points: number;
  /** Part du bonus « première fois » dans `points` (0 sinon). */
  bonus: number;
  avant: number; apres: number; niveauAvant: number; niveauApres: number;
}

/** Calcul pur d'un gain : jamais négatif. `premiere` : c'est la première fois pour cette catégorie. */
export function appliquer(xp: number, source: SourceXp, premiere = false): Gain {
  const avant = Math.max(0, Math.floor(xp) || 0), bonus = premiere ? BONUS_PREMIERE[premiereDe(source)] : 0;
  const points = GAINS[source] + bonus, apres = avant + points;
  return { source, points, bonus, avant, apres, niveauAvant: niveauDe(avant).niveau, niveauApres: niveauDe(apres).niveau };
}

/**
 * Source d'XP d'une partie terminée (#233, P4 et P5), ou `null` si elle ne rapporte rien.
 * - 10 coups ou moins : rien (un abandon immédiat ne rapporte pas).
 * - Une partie reprise avec « Rejouer d'ici » (revue) ne rapporte rien : la partie d'origine a déjà payé son XP.
 * - Une victoire contre l'ordi rapporte « victoire », tout le reste « partie ».
 */
export function sourceXpPartie(p: { coups: number; contreOrdi: boolean; gagne: boolean; reprise: boolean }): SourceXp | null {
  if (p.reprise || p.coups < 10) return null;
  return p.contreOrdi && p.gagne ? 'victoire' : 'partie';
}

// --- Stockage sur l'appareil et diffusion aux écrans ---

export const XP_KEY = 'go.xp.v1';

export function lireXp(): number {
  try {
    const v = Number(JSON.parse(localStorage.getItem(XP_KEY) || '0'));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch { return 0; }
}

export const PREMIERES_KEY = 'go.xp.premieres.v1';

export function lirePremieres(): Set<Premiere> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PREMIERES_KEY) || '[]');
    return new Set(Array.isArray(v) ? v.filter((p): p is Premiere => typeof p === 'string' && p in BONUS_PREMIERE) : []);
  } catch { return new Set(); }
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
  const premieres = lirePremieres(), cat = premiereDe(source);
  const g = appliquer(lireXp(), source, !premieres.has(cat));
  try {
    localStorage.setItem(XP_KEY, JSON.stringify(g.apres));
    if (g.bonus) localStorage.setItem(PREMIERES_KEY, JSON.stringify([...premieres, cat]));
  } catch { /* stockage indisponible : le gain reste affiché pour la session */ }
  agregat ??= { points: 0, gains: 0, sources: new Set() };
  agregat.points += g.points; agregat.gains++; agregat.sources.add(source);
  if (minuterie) clearTimeout(minuterie);
  minuterie = setTimeout(envoyerAgregat, DELAI_AGREGAT_MS);
  for (let n = g.niveauAvant + 1; n <= g.niveauApres; n++) track(EVENTS.niveauAtteint, { niveau: n, xp_total: g.apres, source, recompense: recompenseDuNiveau(n)?.id });
  ecouteurs.forEach(fn => fn(g));
  return g;
}
