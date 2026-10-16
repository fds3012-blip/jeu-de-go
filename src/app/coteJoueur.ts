// « Continuer » à ta mesure (issue #284) : cote du joueur et choix du prochain problème. Logique pure, sans React.
//
// Modèle : Elo simple, à K dégressif (un peu de Glicko : K est grand tant qu'on connaît mal le joueur).
// La difficulté de chaque problème (`difficulty`) est déjà une cote Elo. Chance de réussite prévue :
//   P = 1 / (1 + 10^((difficulté − cote) / 400))
// Cible : 85 % de réussite au premier essai (Wilson et al., 2019). Elle donne un problème environ 300 points
// sous la cote du joueur. Trois réussites d'affilée : un peu plus dur. Un échec : le suivant est plus facile.
//
// La cote n'est jamais affichée (décision #137 : problèmes infinis, pas de progression visible).
// Elle vit sur l'appareil, sous la clé COTE_KEY, citée dans la politique de confidentialité.

// #563 : COTE_KEY, COTE_DEPART, l'état de la cote et nettoyerCote sont dans coteEtat.ts (JS initial), réexportés ici.
import { borner, type EtatCote, type Resultat } from './coteEtat';
export { COTE_DEPART, COTE_KEY, ETAT_INITIAL, nettoyerCote, type DernierEssai, type EtatCote, type Resultat } from './coteEtat';

/** Taux de réussite visé au premier essai. */
export const REUSSITE_CIBLE = 0.85;
/** Écart cote − difficulté qui donne la réussite visée (environ 301 points). */
export const ECART_CIBLE = 400 * Math.log10(REUSSITE_CIBLE / (1 - REUSSITE_CIBLE));
/** Plus grand écart de difficulté entre deux problèmes proposés de suite, et plus grand pas de la cote. */
export const SAUT_MAX = 200;

/** K dégressif : K_MAX au premier essai, divisé par deux après K_DEMI essais, jamais sous K_MIN. */
export const K_MAX = 160;
export const K_DEMI = 12;
export const K_MIN = 24;

/**
 * Réussites d'affilée : à partir de SERIE_DEBUT, le problème suivant est un peu plus dur, d'un pas par réussite,
 * au plus PAS_MAX_NB pas. Le pas vaut PAS_SERIE quand la cote est sûre ; il grandit de PAS_PLACEMENT tant que K est
 * grand (premiers essais) : un nouveau joueur qui enchaîne les réussites quitte vite les problèmes trop faciles.
 */
export const SERIE_DEBUT = 3;
export const PAS_SERIE = 15;
export const PAS_PLACEMENT = 90;
export const PAS_MAX_NB = 3;

export const SCORE: Record<Resultat, number> = { premier: 1, aide: 0.2, rate: 0 };

/** Chance de réussite prévue d'un joueur de cote `cote` sur un problème de difficulté `difficulte`. */
export function chance(cote: number, difficulte: number): number {
  return 1 / (1 + 10 ** ((difficulte - cote) / 400));
}

/** K du prochain essai : dégressif avec le nombre d'essais notés. */
export function kPour(essais: number): number {
  return Math.max(K_MIN, (K_MAX * K_DEMI) / (K_DEMI + essais));
}

/** Difficulté visée pour le prochain problème : 85 % de réussite, un peu plus dur après 3 réussites d'affilée. */
export function cible(etat: EtatCote): number {
  return etat.cote - ECART_CIBLE + bonusSerie(etat);
}

/** Points ajoutés à la cible après SERIE_DEBUT réussites d'affilée. */
export function bonusSerie(etat: EtatCote): number {
  if (etat.serie < SERIE_DEBUT) return 0;
  const incertitude = (kPour(etat.essais) - K_MIN) / (K_MAX - K_MIN);
  return Math.min(PAS_MAX_NB, etat.serie - SERIE_DEBUT + 1) * (PAS_SERIE + PAS_PLACEMENT * incertitude);
}

/** Pas de cote borné à ±SAUT_MAX (K ≤ SAUT_MAX le garantit déjà ; la borne protège d'un réglage futur). */
const pas = (k: number, score: number, attendu: number) => borner(k * (score - attendu), -SAUT_MAX, SAUT_MAX);

/**
 * Note le premier essai d'un problème. `jour` : numéro du jour (numeroDuJour), pour « pas deux fois le même jour ».
 * Un problème déjà noté aujourd'hui ne change plus la cote (Rejouer ne compte pas).
 */
export function noter(etat: EtatCote, pb: { id: string; difficulty: number }, resultat: Resultat, jour: number): EtatCote {
  const vus = etat.jour === jour ? etat.vusDuJour : [];
  if (vus.includes(pb.id)) return etat;
  const k = kPour(etat.essais);
  const attendu = chance(etat.cote, pb.difficulty);
  return {
    cote: borner(etat.cote + pas(k, SCORE[resultat], attendu), 0, 3000),
    essais: etat.essais + 1,
    serie: resultat === 'premier' ? etat.serie + 1 : 0,
    dernier: { id: pb.id, difficulte: pb.difficulty, resultat, k, attendu },
    precedent: { id: pb.id, difficulte: pb.difficulty },
    jour,
    vusDuJour: [...vus, pb.id].slice(-200)
  };
}

/**
 * Un problème raté au premier essai, puis réussi seul (sans indice ni réponse) : il compte comme « réussi avec aide ».
 * On rend la part de cote correspondante, avec le même K et la même chance prévue qu'au premier essai.
 * Sans effet si le dernier essai noté n'est pas cet échec.
 */
export function requalifierEnAide(etat: EtatCote, id: string): EtatCote {
  const d = etat.dernier;
  if (!d || d.id !== id || d.resultat !== 'rate') return etat;
  const avant = pas(d.k, SCORE.rate, d.attendu);
  const apres = pas(d.k, SCORE.aide, d.attendu);
  return { ...etat, cote: borner(etat.cote + apres - avant, 0, 3000), dernier: { ...d, resultat: 'aide' } };
}

/** Un problème est ouvert hors Go du jour (même déjà réussi) : il devient la référence du prochain choix. */
export function ouvrir(etat: EtatCote, pb: { id: string; difficulty: number }): EtatCote {
  if (etat.precedent?.id === pb.id && etat.precedent.difficulte === pb.difficulty) return etat;
  return { ...etat, precedent: { id: pb.id, difficulte: pb.difficulty } };
}

/**
 * Prochain problème de « Continuer » : parmi les problèmes pas encore réussis, celui dont la difficulté est la plus
 * proche de la cible (85 % de réussite prévue). Préférences, chacune gardée seulement s'il reste un candidat :
 * 1. jamais `eviter` ni le problème précédent (jamais deux fois le même de suite) ;
 * 2. pas un problème déjà noté aujourd'hui (#237) ;
 * 3. après un échec sur le problème précédent (même réussi ensuite avec aide), plus facile que lui.
 * Jamais plus de SAUT_MAX points d'écart avec le problème précédent : si aucun problème à réussir n'est à portée,
 * on passe par un problème déjà réussi, à portée, qui rapproche du meilleur problème à réussir (pont).
 * `undefined` s'il ne reste aucun problème à réussir : l'appelant garde alors sa série infinie (#147).
 */
export function choisirProbleme<T extends { id: string; difficulty: number }>(
  liste: readonly T[], etat: EtatCote, reussis: ReadonlySet<string>,
  { jour, eviter, alea = Math.random }: { jour: number; eviter?: string; alea?: () => number }
): T | undefined {
  const prec = etat.precedent ?? (etat.dernier && { id: etat.dernier.id, difficulte: etat.dernier.difficulte });
  const d = etat.dernier;
  const garder = (ps: T[], f: (p: T) => boolean) => { const r = ps.filter(f); return r.length ? r : ps; };
  const plusProche = (ps: T[], x: number) => {
    const m = Math.min(...ps.map(p => Math.abs(p.difficulty - x)));
    const ex = ps.filter(p => Math.abs(p.difficulty - x) === m);
    return ex[Math.min(ex.length - 1, Math.floor(alea() * ex.length))];
  };
  let pool = liste.filter(p => !reussis.has(p.id) && p.id !== eviter);
  if (prec) pool = garder(pool, p => p.id !== prec.id);
  if (!pool.length) return undefined;
  if (etat.jour === jour) pool = garder(pool, p => !etat.vusDuJour.includes(p.id));
  if (prec && d && d.id === prec.id && d.resultat !== 'premier') pool = garder(pool, p => p.difficulty < d.difficulte);
  const c = cible(etat);
  if (!prec) return plusProche(pool, c);
  const aPortee = (p: T) => Math.abs(p.difficulty - prec.difficulte) <= SAUT_MAX;
  const proches = pool.filter(aPortee);
  if (proches.length) return plusProche(proches, c);
  // Pont : le meilleur problème à réussir est trop loin ; un problème à portée (même déjà réussi) rapproche de lui.
  const but = plusProche(pool, c);
  const ponts = liste.filter(p => aPortee(p) && p.id !== prec.id && p.id !== eviter);
  return ponts.length ? plusProche(ponts, but.difficulty) : but;
}
