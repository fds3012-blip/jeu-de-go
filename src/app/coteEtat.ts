// « Continuer » à ta mesure (issue #284) : état de la cote du joueur gardé sur l'appareil (#563 : à part de
// src/app/coteJoueur.ts, qui le réexporte, pour que l'accueil n'emporte pas le modèle Elo ni le choix du problème).
// La cote n'est jamais affichée (décision #137). Elle vit sur l'appareil, sous la clé COTE_KEY, citée dans la politique
// de confidentialité.

/** Clé de stockage local. */
export const COTE_KEY = 'go.cote-joueur.v1';

/** Cote de départ, prudente : sous tous les problèmes, le premier sera parmi les plus faciles. */
export const COTE_DEPART = 400;
/**
 * Résultat d'un problème :
 * - `premier` : réussi du premier coup (score 1) ;
 * - `aide` : raté au premier essai, puis réussi seul, sans indice ni réponse (score partiel) ;
 * - `rate` : raté au premier essai, puis indice, réponse vue ou problème quitté (score 0).
 */
export type Resultat = 'premier' | 'aide' | 'rate';
export interface DernierEssai {
  id: string;
  difficulte: number;
  resultat: Resultat;
  /** K et chance prévue utilisés : pour requalifier un échec en réussite avec aide sans rejouer l'Elo. */
  k: number;
  attendu: number;
}

export interface EtatCote {
  cote: number;
  /** Premiers essais notés. */
  essais: number;
  /** Réussites du premier coup d'affilée. */
  serie: number;
  dernier?: DernierEssai;
  /** Dernier problème ouvert hors Go du jour (noté ou rejoué) : jamais deux fois de suite, pas de saut de plus de SAUT_MAX. */
  precedent?: { id: string; difficulte: number };
  /** Numéro du jour (Go du jour) et problèmes déjà notés ce jour-là : ils ne reviennent pas le même jour (#237). */
  jour: number;
  vusDuJour: string[];
}

export const ETAT_INITIAL: EtatCote = { cote: COTE_DEPART, essais: 0, serie: 0, jour: 0, vusDuJour: [] };

const fini = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** État relu du stockage : tout champ abîmé revient à sa valeur de départ. */
export function nettoyerCote(brut: unknown): EtatCote {
  if (!brut || typeof brut !== 'object') return { ...ETAT_INITIAL, vusDuJour: [] };
  const b = brut as Record<string, unknown>;
  const d = b.dernier as Record<string, unknown> | undefined;
  const dernier: DernierEssai | undefined = d && typeof d === 'object' && typeof d.id === 'string' && fini(d.difficulte)
    && (d.resultat === 'premier' || d.resultat === 'aide' || d.resultat === 'rate') && fini(d.k) && fini(d.attendu)
    ? { id: d.id, difficulte: d.difficulte, resultat: d.resultat, k: d.k, attendu: d.attendu } : undefined;
  const p = b.precedent as Record<string, unknown> | undefined;
  const precedent = p && typeof p === 'object' && typeof p.id === 'string' && fini(p.difficulte) ? { id: p.id, difficulte: p.difficulte } : undefined;
  return {
    cote: fini(b.cote) ? borner(b.cote, 0, 3000) : COTE_DEPART,
    essais: fini(b.essais) && b.essais >= 0 ? Math.floor(b.essais) : 0,
    serie: fini(b.serie) && b.serie >= 0 ? Math.floor(b.serie) : 0,
    ...(dernier ? { dernier } : {}),
    ...(precedent ? { precedent } : {}),
    jour: fini(b.jour) ? b.jour : 0,
    vusDuJour: Array.isArray(b.vusDuJour) ? b.vusDuJour.filter((x): x is string => typeof x === 'string').slice(-200) : []
  };
}
