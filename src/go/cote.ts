// Cote de jeu (issue #417) : Glicko-2, barème en grades kyu/dan et point de départ. Logique pure, sans React.
//
// Le serveur fait foi : `public.glicko2` et `public.apply_game_rating` (supabase/migrations/20261004120100_cote_glicko.sql)
// font exactement le même calcul, mêmes constantes, mêmes arrondis. Ce module sert aux tests, à la spec
// (docs/game-design/cote.md) et à l'affichage (grade, « 1200 ? »). Le client n'écrit jamais une cote.
//
// Seules les parties classées entre humains comptent. Les parties contre les IA, les défis, les problèmes et les leçons
// ne changent pas cette cote.

/** Échelle de Glicko-2 : 173,7178 = 400 / ln 10. */
export const ECHELLE = 173.7178;
/** Centre de l'échelle de Glicko-2 (la formule ne dépend que des écarts : le centre n'a pas d'effet sur le calcul). */
export const CENTRE = 1500;
/** Écart de confiance (RD) d'un joueur inconnu, et plafond après une longue absence. */
export const RD_DEPART = 350;
/** Plancher de l'écart de confiance : la cote garde toujours un peu de mouvement. */
export const RD_MIN = 50;
/** Volatilité de départ. */
export const VOL_DEPART = 0.06;
/** τ : contrainte sur la volatilité (0,3 à 1,2 selon Glickman ; 0,5 est le choix courant). */
export const TAU = 0.5;
/** Précision de l'algorithme d'Illinois (volatilité). */
export const EPSILON = 0.000001;
/** Cote provisoire (« 1200 ? ») tant que l'écart de confiance dépasse ce seuil : environ 10 premières parties. */
export const RD_PROVISOIRE = 110;
/** Une période d'inactivité : 30 jours sans partie classée font grandir l'écart de confiance. */
export const JOURS_PAR_PERIODE = 30;
/** Bornes de la cote enregistrée. */
export const COTE_MIN = 0;
export const COTE_MAX = 4000;

export interface Joueur {
  cote: number;
  rd: number;
  vol: number;
}

export interface Adversaire {
  cote: number;
  rd: number;
  /** 1 : victoire, 0 : défaite, 0,5 : partie nulle. */
  score: number;
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const attendu = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/**
 * Glicko-2 brut (Glickman, « Example of the Glicko-2 system », 2013), sans arrondi ni borne :
 * une période de classement contre une liste d'adversaires. Sans adversaire, seul l'écart de confiance grandit.
 */
export function glicko2Brut(j: Joueur, adversaires: readonly Adversaire[], tau = TAU): Joueur {
  const mu = (j.cote - CENTRE) / ECHELLE;
  const phi = j.rd / ECHELLE;
  const sigma = j.vol;
  if (!adversaires.length) return { cote: j.cote, rd: Math.sqrt(phi * phi + sigma * sigma) * ECHELLE, vol: sigma };
  let inverseV = 0;
  let somme = 0;
  for (const a of adversaires) {
    const muJ = (a.cote - CENTRE) / ECHELLE, phiJ = a.rd / ECHELLE;
    const e = attendu(mu, muJ, phiJ), gj = g(phiJ);
    inverseV += gj * gj * e * (1 - e);
    somme += gj * (a.score - e);
  }
  const v = 1 / inverseV;
  const delta = v * somme;
  // Nouvelle volatilité : algorithme d'Illinois.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x), d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPSILON; i++) {
    const C = A + ((A - B) * fA) / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const sigma2 = Math.exp(A / 2);
  const phiEtoile = Math.sqrt(phi * phi + sigma2 * sigma2);
  const phi2 = 1 / Math.sqrt(1 / (phiEtoile * phiEtoile) + 1 / v);
  const mu2 = mu + phi2 * phi2 * somme;
  return { cote: mu2 * ECHELLE + CENTRE, rd: phi2 * ECHELLE, vol: sigma2 };
}

/** Écart de confiance après `jours` sans partie classée : grandit d'une période tous les 30 jours, jamais au-delà de 350. */
export function rdApresAbsence(rd: number, vol: number, jours: number): number {
  const n = Math.max(0, Math.floor(jours / JOURS_PAR_PERIODE));
  if (!n) return rd;
  const phi = rd / ECHELLE;
  return Math.min(RD_DEPART, Math.sqrt(phi * phi + n * vol * vol) * ECHELLE);
}

const arrondi = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/**
 * Une partie classée, comme le serveur : chaque joueur est mis à jour contre la cote d'avant-partie de l'autre.
 * Arrondis du serveur : cote entière, RD au centième (plancher RD_MIN), volatilité au millionième.
 * `jours` : jours écoulés depuis la dernière partie classée de chacun (absence).
 */
export function partieClassee(
  gagnant: Joueur, perdant: Joueur, jours: { gagnant?: number; perdant?: number } = {}
): { gagnant: Joueur & { ecart: number }; perdant: Joueur & { ecart: number } } {
  const w = { ...gagnant, rd: rdApresAbsence(gagnant.rd, gagnant.vol, jours.gagnant ?? 0) };
  const l = { ...perdant, rd: rdApresAbsence(perdant.rd, perdant.vol, jours.perdant ?? 0) };
  const fin = (avant: Joueur, apres: Joueur) => {
    const cote = Math.min(COTE_MAX, Math.max(COTE_MIN, Math.round(apres.cote)));
    return { cote, rd: Math.max(RD_MIN, arrondi(apres.rd, 2)), vol: arrondi(apres.vol, 6), ecart: cote - avant.cote };
  };
  return {
    gagnant: fin(gagnant, glicko2Brut(w, [{ cote: l.cote, rd: l.rd, score: 1 }])),
    perdant: fin(perdant, glicko2Brut(l, [{ cote: w.cote, rd: w.rd, score: 0 }])),
  };
}

/** Cote provisoire : l'écart de confiance est encore grand. */
export const estProvisoire = (rd: number) => rd > RD_PROVISOIRE;

// ——— Barème : 100 points = 1 grade ; cote = 3000 − 100 × kyu ———

/** Cote du 1er dan. */
export const COTE_PREMIER_DAN = 3000;
/** Plus haut grade affiché. */
export const DAN_MAX = 9;
/** Plus bas grade. */
export const KYU_MAX = 30;

export type Grade = { sorte: 'kyu' | 'dan'; n: number };

/**
 * Grade d'une cote. Chaque grade couvre 100 points, borne basse comprise :
 * 2900 à 2999 = 1er kyu, 3000 à 3099 = 1er dan, 1500 à 1599 = 15e kyu, 0 à 99 = 30e kyu.
 * Sous 0 : 30e kyu ; au-delà de 3800 : 9e dan (plafond affiché).
 */
export function gradeDe(cote: number): Grade {
  const c = Math.floor(Number.isFinite(cote) ? cote : 0);
  if (c >= COTE_PREMIER_DAN) return { sorte: 'dan', n: Math.min(DAN_MAX, Math.floor((c - COTE_PREMIER_DAN) / 100) + 1) };
  return { sorte: 'kyu', n: Math.min(KYU_MAX, Math.max(1, Math.ceil((COTE_PREMIER_DAN - c) / 100))) };
}

/** Rang d'un grade, du plus faible (30e kyu = 1) au plus fort (9e dan = 39) : pour comparer deux grades. */
export const rangGrade = (g: Grade) => (g.sorte === 'kyu' ? KYU_MAX + 1 - g.n : KYU_MAX + g.n);

/** Cote d'entrée d'un grade (borne basse) : 15e kyu → 1500, 1er dan → 3000. */
export const coteDuGrade = (g: Grade) => (g.sorte === 'kyu' ? COTE_PREMIER_DAN - 100 * g.n : COTE_PREMIER_DAN + 100 * (g.n - 1));

/** Changement de grade après une partie : `monte` (fête), `descend` (dit sans drame) ou null. */
export function changementGrade(avant: number, apres: number): { sens: 'monte' | 'descend'; grade: Grade } | null {
  const a = gradeDe(avant), b = gradeDe(apres);
  const d = rangGrade(b) - rangGrade(a);
  return d === 0 ? null : { sens: d > 0 ? 'monte' : 'descend', grade: b };
}

/** Grade écrit : « 15ᵉ kyu », « 1ᵉʳ kyu », « 1ᵉʳ dan » en français ; « 15 kyu », « 1 dan » en anglais. */
export function texteGrade(g: Grade, langue: 'fr' | 'en' = 'fr'): string {
  if (langue === 'en') return `${g.n} ${g.sorte}`;
  return `${g.n}${g.n === 1 ? 'ᵉʳ' : 'ᵉ'}\u00a0${g.sorte}`;
}

// ——— Point de départ, choisi une fois avant la première partie classée ———

export type Depart = 'decouvre' | 'regles' | 'club';
export const DEPARTS: readonly Depart[] = ['decouvre', 'regles', 'club'];
/** Cote de départ de « Je découvre » (27e kyu) et « Je connais les règles » (22e kyu). */
export const COTE_DECOUVRE = 300;
export const COTE_REGLES = 800;
/** « Je joue en club » : grade choisi de 25e kyu à 1er dan (kyu = 0 pour le 1er dan). */
export const KYU_CLUB_MAX = 25;
export const KYU_CLUB_MIN = 0;
/** Grades proposés à « Je joue en club », du plus faible au plus fort (0 = 1er dan). */
export const KYUS_CLUB: readonly number[] = /* @__PURE__ */ Array.from({ length: KYU_CLUB_MAX - KYU_CLUB_MIN + 1 }, (_, i) => KYU_CLUB_MAX - i);
/** Grade de club proposé par défaut. */
export const KYU_CLUB_DEFAUT = 15;

/** Grade de « Je joue en club » : kyu de 1 à 25, ou 0 pour le 1er dan. */
export const gradeClub = (kyu: number): Grade => (kyu === 0 ? { sorte: 'dan', n: 1 } : { sorte: 'kyu', n: kyu });

/** Cote de départ, ou null si le choix est invalide (le serveur refuse les mêmes cas). */
export function coteDepart(depart: Depart, kyu?: number | null): number | null {
  if (depart === 'decouvre') return kyu == null ? COTE_DECOUVRE : null;
  if (depart === 'regles') return kyu == null ? COTE_REGLES : null;
  if (depart === 'club') {
    if (kyu == null || !Number.isInteger(kyu) || kyu < KYU_CLUB_MIN || kyu > KYU_CLUB_MAX) return null;
    return COTE_PREMIER_DAN - 100 * kyu;
  }
  return null;
}
