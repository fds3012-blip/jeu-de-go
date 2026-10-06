// Ta semaine (issue #369, décision du 05/10) : objectifs personnels de la semaine et bilan de la semaine passée,
// gardés sur l'appareil. Rien ici ne compare des joueurs (le serveur s'en charge : src/data/emulation.ts).
// Semaine : du lundi 0 h au dimanche 24 h, heure de Paris (même horloge que le Go du jour).
//
// Objectifs : trois compteurs (parties terminées, problèmes réussis, erreurs rejouées). Cible de départ 3 / 5 / 2 ;
// ensuite, au moins ce que tu as fait la semaine d'avant, sans dépasser un plafond (7 / 15 / 5) : la cible suit ton
// rythme sans devenir une corvée. Chaque objectif atteint rapporte `GAINS.objectif` XP, une fois par semaine
// (docs/game-design/economie.md). Pas de perte, pas de minuteur, pas de reproche : une semaine manquée ne coûte rien.
//
// Bilan : au premier passage d'une nouvelle semaine, l'accueil montre une fois la semaine qui vient de finir
// (src/ui/BilanSemaine.tsx), si elle a compté au moins une activité. Il ne revient pas avant la semaine suivante.
import { dateParis } from './goDuJour';

export const SEMAINE_KEY = 'go.semaine.v1';

/** Compteurs suivis. Les objectifs portent sur les trois premiers ; Go du jour et leçons servent au bilan. */
export type Compteur = 'parties' | 'problemes' | 'erreurs' | 'goDuJour' | 'lecons';
export type Objectif = 'parties' | 'problemes' | 'erreurs';
export const OBJECTIFS: readonly Objectif[] = ['parties', 'problemes', 'erreurs'];
export const CIBLES_DEPART: Readonly<Record<Objectif, number>> = { parties: 3, problemes: 5, erreurs: 2 };
export const PLAFONDS: Readonly<Record<Objectif, number>> = { parties: 7, problemes: 15, erreurs: 5 };

export interface Semaine {
  /** Lundi de la semaine (AAAA-MM-JJ, heure de Paris). */
  lundi: string;
  compte: Record<Compteur, number>;
  cibles: Record<Objectif, number>;
  /** Objectifs déjà atteints (et récompensés) cette semaine. */
  atteints: Objectif[];
}

export interface EtatSemaine {
  courante: Semaine;
  /** La semaine juste avant la courante, si l'app a servi pendant. */
  precedente: Semaine | null;
  /** Lundi de la semaine dont le bilan a déjà été montré. */
  bilanVu: string | null;
}

const JOUR = 86_400_000;
const COMPTEURS: readonly Compteur[] = ['parties', 'problemes', 'erreurs', 'goDuJour', 'lecons'];

/** Décale une date AAAA-MM-JJ de `n` jours (calcul en UTC, sans fuseau). */
export function decaler(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * JOUR).toISOString().slice(0, 10);
}

/** Lundi de la semaine d'un instant, heure de Paris. */
export function lundiDe(instant: Date): string {
  const jour = dateParis(instant);
  const [y, m, d] = jour.split('-').map(Number);
  const rang = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // lundi 0 … dimanche 6
  return decaler(jour, -rang);
}

const zero = (): Record<Compteur, number> => ({ parties: 0, problemes: 0, erreurs: 0, goDuJour: 0, lecons: 0 });

/** Cibles de la semaine : au moins le départ, au moins ce qui a été fait la semaine d'avant, au plus le plafond. */
export function cibles(avant: Semaine | null): Record<Objectif, number> {
  const c = { ...CIBLES_DEPART };
  for (const o of OBJECTIFS) c[o] = Math.min(PLAFONDS[o], Math.max(CIBLES_DEPART[o], avant?.compte[o] ?? 0));
  return c;
}

export function nouvelleSemaine(lundi: string, avant: Semaine | null): Semaine {
  return { lundi, compte: zero(), cibles: cibles(avant && decaler(avant.lundi, 7) === lundi ? avant : null), atteints: [] };
}

const estDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const nombre = (v: unknown, min = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.floor(v)) : min);

function lireSemaine(v: unknown): Semaine | null {
  const s = v as Partial<Semaine> | null;
  if (!s || typeof s !== 'object' || !estDate(s.lundi)) return null;
  const compte = zero();
  for (const k of COMPTEURS) compte[k] = nombre((s.compte as Record<string, unknown> | undefined)?.[k]);
  const c = { ...CIBLES_DEPART };
  for (const o of OBJECTIFS) {
    const v = (s.cibles as Record<string, unknown> | undefined)?.[o];
    c[o] = typeof v === 'number' && Number.isFinite(v) ? Math.min(PLAFONDS[o], nombre(v, 1)) : CIBLES_DEPART[o];
  }
  const atteints = Array.isArray(s.atteints) ? OBJECTIFS.filter(o => (s.atteints as unknown[]).includes(o)) : [];
  return { lundi: s.lundi, compte, cibles: c, atteints };
}

/**
 * État lu sur l'appareil, mis à la semaine de `lundi` : une semaine nouvelle remplace la courante, qui devient la
 * précédente si elle la suit directement. Lecture tolérante : un état abîmé repart de zéro, sans erreur.
 */
export function lireEtat(brut: unknown, lundi: string): EtatSemaine {
  const e = brut as Partial<EtatSemaine> | null;
  let courante = lireSemaine(e?.courante);
  let precedente = lireSemaine(e?.precedente);
  const bilanVu = estDate(e?.bilanVu) ? e.bilanVu : null;
  // Horloge revenue en arrière (réglage de l'appareil) : on garde la semaine connue la plus récente.
  if (courante && courante.lundi > lundi) return { courante, precedente, bilanVu };
  if (!courante || courante.lundi !== lundi) {
    const avant = courante && decaler(courante.lundi, 7) === lundi ? courante : null;
    precedente = avant ?? (precedente && decaler(precedente.lundi, 7) === lundi ? precedente : null);
    courante = nouvelleSemaine(lundi, avant);
  }
  return { courante, precedente, bilanVu };
}

/**
 * Une activité de plus (`n` fois). Renvoie l'état suivant et les objectifs qui viennent d'être atteints, à
 * récompenser une seule fois. Un compteur sans objectif (Go du jour, leçons) n'en atteint jamais.
 */
export function compter(e: EtatSemaine, quoi: Compteur, n = 1): { etat: EtatSemaine; atteints: Objectif[] } {
  const s = e.courante;
  const compte = { ...s.compte, [quoi]: s.compte[quoi] + Math.max(0, Math.floor(n)) };
  const nouveaux = OBJECTIFS.filter(o => o === quoi && !s.atteints.includes(o) && compte[o] >= s.cibles[o]);
  return { etat: { ...e, courante: { ...s, compte, atteints: [...s.atteints, ...nouveaux] } }, atteints: nouveaux };
}

/** Progression d'un objectif, bornée à la cible (« 2 / 3 »). */
export const progression = (s: Semaine, o: Objectif) => ({ fait: Math.min(s.compte[o], s.cibles[o]), cible: s.cibles[o], atteint: s.atteints.includes(o) });

/** Objectifs atteints cette semaine. */
export const nombreAtteints = (s: Semaine) => s.atteints.length;

/** Premier objectif pas encore atteint, dans l'ordre parties, problèmes, erreurs ; null si tout est fait. */
export const prochainObjectif = (s: Semaine): Objectif | null => OBJECTIFS.find(o => !s.atteints.includes(o)) ?? null;

/** Quelque chose à raconter : au moins une partie, un problème, une erreur rejouée, un Go du jour ou une leçon. */
export const activite = (s: Semaine) => COMPTEURS.some(k => s.compte[k] > 0);

/** Le bilan de la semaine passée est à montrer : elle a compté, et il n'a pas encore été vu. */
export function bilanAMontrer(e: EtatSemaine): Semaine | null {
  const p = e.precedente;
  return p && decaler(p.lundi, 7) === e.courante.lundi && e.bilanVu !== p.lundi && activite(p) ? p : null;
}

/** Bilan marqué vu : il ne revient pas avant la semaine suivante. */
export const marquerBilanVu = (e: EtatSemaine, lundi: string): EtatSemaine => ({ ...e, bilanVu: lundi });

// --- Stockage sur l'appareil ---

function lireBrut(): unknown {
  try { return JSON.parse(localStorage.getItem(SEMAINE_KEY) ?? 'null'); } catch { return null; }
}
function ecrire(e: EtatSemaine): void {
  try { localStorage.setItem(SEMAINE_KEY, JSON.stringify(e)); } catch { /* stockage indisponible : rien ne se perd à l'écran */ }
}

/** État de la semaine d'aujourd'hui, lu sur l'appareil (et écrit s'il change de semaine). */
export function etatSemaine(maintenant = new Date()): EtatSemaine {
  const brut = lireBrut();
  const e = lireEtat(brut, lundiDe(maintenant));
  if (JSON.stringify(e) !== JSON.stringify(brut)) ecrire(e);
  return e;
}

/** Note une activité sur l'appareil ; renvoie les objectifs atteints à l'instant. */
export function noterSemaine(quoi: Compteur, n = 1, maintenant = new Date()): Objectif[] {
  const r = compter(etatSemaine(maintenant), quoi, n);
  ecrire(r.etat);
  return r.atteints;
}

/** Le bilan de la semaine passée vient d'être montré. */
export function noterBilanVu(lundi: string, maintenant = new Date()): void {
  ecrire(marquerBilanVu(etatSemaine(maintenant), lundi));
}
