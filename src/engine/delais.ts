// Délais maximaux des demandes au moteur (#498). iOS (ou le navigateur) peut tuer un Worker sans le moindre événement
// `error` : sans délai, la promesse restait en attente et l'ordi « réfléchissait » pour toujours.
// Les délais sont généreux : un téléphone lent ne doit jamais être pris pour un Worker mort. La recherche elle-même
// est bornée en temps (`timeMs`) ; le délai couvre en plus le démarrage du Worker, la file d'attente et les écarts
// d'un appareil lent, et grandit avec la taille du plateau.

/** Délai dépassé : le Worker ne répond plus (tué, gelé) ou répond beaucoup trop tard. */
export class DelaiDepasse extends Error {
  constructor(message = 'délai dépassé') { super(message); this.name = 'DelaiDepasse'; }
}

/** Le moteur ne répond plus, même après une relance du Worker et un nouvel essai. */
export class MoteurBloque extends DelaiDepasse {
  constructor(message = 'moteur bloqué : pas de réponse après relance') { super(message); this.name = 'MoteurBloque'; }
}

export const estDelaiDepasse = (e: unknown): e is DelaiDepasse => e instanceof Error && (e.name === 'DelaiDepasse' || e.name === 'MoteurBloque');
export const estMoteurBloque = (e: unknown): e is MoteurBloque => e instanceof Error && e.name === 'MoteurBloque';

/** Part fixe : chargement du module du Worker, première compilation, appareil lent ou en économie d'énergie. */
export const DELAI_BASE_MS = 8000;
/** Attente de la réponse à un « ping » au retour au premier plan. */
export const DELAI_PING_MS = 8000;

let echelle = 1;
/** Tests seulement : multiplie tous les délais (0,01 : cent fois plus courts). */
export function reglerEchelleDelais(e: number) { echelle = e > 0 && Number.isFinite(e) ? e : 1; }
export function echelleDelais(): number { return echelle; }

/** 9 × 9 : 1 ; 13 × 13 : 2 ; 19 × 19 : 4 (environ le nombre d'intersections, rapporté au 9 × 9). */
export function facteurTaille(size: number): number {
  return size <= 9 ? 1 : size <= 13 ? 2 : 4;
}

/**
 * Délai d'une tâche du moteur simple dont le calcul est borné à `budgetMs` : trois fois le budget (appareil lent),
 * plus la réflexion supplémentaire après une passe (gainDuCoup, 1,5 s au plus), selon la taille, plus la part fixe.
 */
export function delaiTache(budgetMs: number, size: number): number {
  return Math.round(echelle * (DELAI_BASE_MS + 3 * (budgetMs + 1500) * facteurTaille(size)));
}

/**
 * Délai d'une analyse KataGo : la recherche s'arrête au premier des deux plafonds (visites, `timeMs`). Sans `timeMs`,
 * on compte 60 ms par visite (CPU d'un téléphone lent). Deux fois l'estimation, selon la taille, plus la part fixe.
 */
export function delaiAnalyse(opts: { timeMs?: number; visits?: number }, size: number): number {
  const parVisites = (opts.visits ?? 64) * 60;
  const estime = opts.timeMs !== undefined ? Math.min(opts.timeMs, parVisites) : parVisites;
  return Math.round(echelle * (DELAI_BASE_MS + 2 * estime * facteurTaille(size)));
}

/** Délai du « ping » de vérification. */
export function delaiPing(): number { return Math.round(echelle * DELAI_PING_MS); }

/** Rejette avec `DelaiDepasse` si `p` n'est pas terminée à temps. La minuterie est toujours libérée. */
export function sousDelai<T>(p: Promise<T>, ms: number, message?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new DelaiDepasse(message)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
