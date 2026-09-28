// « Je sais déjà jouer » (issue #283) : placement en 3 problèmes et niveau de départ en kyu. Logique pure, sans React.
//
// 1. Trois problèmes pris dans les lots prouvés, adaptatifs : on commence vers 600 ; une réussite fait monter
//    (900, puis 1 250), un échec fait descendre (400, puis 200 ou 700). Le chemin tout réussi est donc 600, 900, 1 250.
// 2. Cote de départ : la « performance » Elo des 3 essais, moyenne des difficultés ± 400 × (réussites − échecs) / 3.
//    Elle devient la cote de « Continuer à ta mesure » (coteJoueur.ts, #284) : les problèmes démarrent à ce palier.
// 3. Kyu estimé : table linéaire documentée, KYU_ANCRE_COTE (cote de départ d'un débutant, COTE_DEPART) = 25 kyu,
//    et un kyu de mieux tous les POINTS_PAR_KYU points ; borné de 25 à 1 kyu. C'est une estimation (« environ ») :
//    trois problèmes ne mesurent que la lecture, pas la partie.
// 4. Adversaire conseillé : le plus fort de l'échelle dont le rang (en kyu) n'est pas au-dessus du tien. Une première
//    partie à ta hauteur, un peu en dessous plutôt qu'au-dessus.
// Tout raté : pas de kyu annoncé, on renvoie vers la leçon 1, sans message d'échec.
import { COTE_DEPART, nettoyerCote, type EtatCote } from './coteJoueur';

/** Clé de stockage local du résultat (citée dans la politique de confidentialité). */
export const PLACEMENT_KEY = 'go.placement.v1';

export const NB_PROBLEMES = 3;
/** Difficulté visée du premier problème. */
export const CIBLE_DEPART = 600;
/** Écart après une réussite (monter) puis après un échec (descendre), étape par étape. */
export const PAS_REUSSITE = [300, 350] as const;
export const PAS_ECHEC = [200, 200] as const;

export const KYU_ANCRE_COTE = COTE_DEPART;
export const KYU_ANCRE = 25;
export const POINTS_PAR_KYU = 55;

export interface Essai { id: string; difficulte: number; ok: boolean }

/** Résultat gardé sur l'appareil. `kyu` null : tout raté (débutant, leçon 1). `saute` : placement passé. */
export type Placement =
  | { fait: true; kyu: number | null; cote: number; adversaire: string; date: string }
  | { fait: false; saute: true; date: string };

/** Difficulté visée pour le problème n° `essais.length + 1`. */
export function cibleSuivante(essais: readonly Essai[]): number {
  let c = CIBLE_DEPART;
  essais.forEach((e, i) => {
    if (i >= NB_PROBLEMES - 1) return;
    c += e.ok ? PAS_REUSSITE[i] : -PAS_ECHEC[i];
  });
  return c;
}

/**
 * Problème suivant : le plus proche de la cible, jamais un déjà posé. À égalité, un 9 × 9 d'abord (lisible sur
 * téléphone), puis l'ordre de la liste : le choix est stable (tests de bout en bout).
 */
export function choisirPlacement<T extends { id: string; difficulty: number; size: number }>(liste: readonly T[], essais: readonly Essai[]): T | undefined {
  const c = cibleSuivante(essais);
  const deja = new Set(essais.map(e => e.id));
  let meilleur: T | undefined;
  let score = Infinity;
  for (const p of liste) {
    if (deja.has(p.id)) continue;
    const s = Math.abs(p.difficulty - c) * 10 + (p.size === 9 ? 0 : 5);
    if (s < score) { score = s; meilleur = p; }
  }
  return meilleur;
}

/** Cote de performance des essais, jamais sous la cote de départ d'un débutant. */
export function coteDePlacement(essais: readonly Essai[]): number {
  if (!essais.length) return COTE_DEPART;
  const moyenne = essais.reduce((s, e) => s + e.difficulte, 0) / essais.length;
  const ecart = essais.reduce((s, e) => s + (e.ok ? 1 : -1), 0) / essais.length;
  return Math.max(COTE_DEPART, Math.round(moyenne + 400 * ecart));
}

/** Table cote → kyu (voir en tête de fichier). */
export function kyuDeCote(cote: number): number {
  const k = Math.round(KYU_ANCRE - (cote - KYU_ANCRE_COTE) / POINTS_PAR_KYU);
  return Math.min(KYU_ANCRE, Math.max(1, k));
}

/** Rang en kyu d'un adversaire (« 13 kyu ») ; un rang en dan compte comme 0 kyu (plus fort que 1 kyu). */
export function kyuDuRang(rang: string): number {
  const m = /(\d+)\s*kyu/i.exec(rang);
  return m ? Number(m[1]) : 0;
}

/** Adversaire conseillé : le plus fort dont le rang n'est pas au-dessus du joueur ; le premier de l'échelle sinon. */
export function adversaireConseille<T extends { rang: string }>(echelle: readonly T[], kyu: number): T {
  let choisi = echelle[0];
  for (const a of echelle) if (kyuDuRang(a.rang) >= kyu) choisi = a;
  return choisi;
}

/** Chapitre de leçons conseillé (index dans CHAPITRES) : les bases jusqu'à 18 kyu, le chapitre suivant ensuite. */
export const KYU_BASES = 18;
export function chapitreConseille(kyu: number | null, nbChapitres: number): number {
  if (kyu === null || kyu >= KYU_BASES) return 0;
  return Math.min(1, Math.max(0, nbChapitres - 1));
}

export interface Bilan { kyu: number | null; cote: number }

/** Bilan des 3 essais. Tout raté : pas de kyu, la cote reste celle d'un débutant. */
export function bilanPlacement(essais: readonly Essai[]): Bilan {
  if (!essais.some(e => e.ok)) return { kyu: null, cote: COTE_DEPART };
  const cote = coteDePlacement(essais);
  return { kyu: kyuDeCote(cote), cote };
}

/**
 * Cote de « Continuer à ta mesure » après le placement : la cote de placement, comptée comme 3 essais
 * (le K dégressif de coteJoueur.ts part donc un peu plus bas). La série et les problèmes du jour sont gardés.
 */
export function coteApresPlacement(brut: unknown, cote: number): EtatCote {
  const e = nettoyerCote(brut);
  return { ...e, cote, essais: Math.max(e.essais, NB_PROBLEMES), serie: 0 };
}

/** Relit le résultat gardé ; null s'il est absent ou abîmé. */
export function lirePlacement(brut: unknown): Placement | null {
  if (!brut || typeof brut !== 'object') return null;
  const b = brut as Record<string, unknown>;
  if (typeof b.date !== 'string') return null;
  if (b.fait === false && b.saute === true) return { fait: false, saute: true, date: b.date };
  if (b.fait !== true || typeof b.cote !== 'number' || !Number.isFinite(b.cote) || typeof b.adversaire !== 'string') return null;
  const kyu = typeof b.kyu === 'number' && Number.isInteger(b.kyu) && b.kyu >= 1 && b.kyu <= KYU_ANCRE ? b.kyu : null;
  return { fait: true, kyu, cote: b.cote, adversaire: b.adversaire, date: b.date };
}

/**
 * Le lien « Je sais déjà jouer » de l'accueil : au premier lancement seulement (premier jour d'ouverture, aucune
 * partie), tant que rien n'est décidé. Ensuite, il vit dans le Profil. `retours` : jours d'ouverture après le premier.
 */
export function proposerPlacement(parties: number, placement: Placement | null, retours = 0): boolean {
  return parties === 0 && retours === 0 && placement === null;
}

/** Nombre d'adversaires ouverts d'office après le placement : jusqu'à l'adversaire conseillé compris. */
export function ouvertsApresPlacement<T extends { id: string }>(echelle: readonly T[], placement: Placement | null, parDefaut: number): number {
  if (!placement?.fait) return parDefaut;
  const i = echelle.findIndex(a => a.id === placement.adversaire);
  return Math.max(parDefaut, i + 1);
}
