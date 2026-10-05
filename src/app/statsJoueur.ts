// « Mes statistiques » du joueur de club (#368, recadrée après #417). Logique pure, testée dans statsJoueur.test.ts.
//
// Depuis #417, le niveau se lit avec la cote Glicko calculée par le serveur (`rating_history`, parties classées entre
// humains) : plus de « niveau estimé » recalculé ici. Cet écran rassemble ce que le joueur ne voyait nulle part :
// - la courbe de sa cote sur 90 jours (lue sous RLS, src/data/statsJoueur.ts) ;
// - sa précision moyenne et ses erreurs par phase, tirées de ses revues avec KataGo, gardées sur l'appareil
//   (STATS_REVUES_KEY, écrites par la revue : src/app/Revue.tsx) ;
// - son bilan par taille et par mode (parties de l'appareil, du compte, défis entre amis, parties classées en ligne).
// Aucun chiffre sur les problèmes ni cote de problème (décision #137, src/app/sansCote.test.ts).
import type { Color } from '../go/rules';
import type { Note } from './revue';
import { issueDe, type PartieHistorique } from './historique';

/** Revues gardées sur l'appareil (les plus récentes d'abord). */
export const STATS_REVUES_KEY = 'go.stats.revues.v1';
export const MAX_REVUES = 50;
/** Nombre de revues qui font la moyenne affichée : les plus récentes, pour suivre les progrès. */
export const REVUES_MOYENNE = 20;

export type Phase = 'ouverture' | 'milieu' | 'fin';
export const PHASES: readonly Phase[] = ['ouverture', 'milieu', 'fin'];
/** Notes comptées comme erreurs : les mêmes que celles qu'on peut rejouer (#77). */
export const NOTES_ERREUR: ReadonlySet<Note> = new Set<Note>(['erreur', 'manque', 'grosse']);

/** Fin de l'ouverture, en coups, selon la taille : environ un septième des intersections (12, 24, 52). */
export function finOuverture(taille: number): number {
  return Math.max(6, Math.round((taille * taille) / 7));
}

/**
 * Phase d'un coup (`coup` de 1 à `total`) : l'ouverture jusqu'à `finOuverture` ; la fin de partie (yose) dans le
 * dernier quart des coups, et jamais avant la fin de l'ouverture ; le milieu entre les deux.
 */
export function phaseDuCoup(coup: number, total: number, taille: number): Phase {
  const ouverture = finOuverture(taille);
  if (coup <= ouverture) return 'ouverture';
  const debutFin = Math.max(ouverture, Math.floor(total * 0.75));
  return coup > debutFin ? 'fin' : 'milieu';
}

/** Une revue avec KataGo, résumée pour les statistiques. */
export interface RevueGardee {
  /** Empreinte du SGF : une partie revue deux fois ne compte qu'une fois (la dernière revue la remplace). */
  cle: string;
  /** Date de la revue (ISO). */
  date: string;
  taille: number;
  /** Précision du joueur, de 0 à 100. */
  precision: number;
  /** Erreurs du joueur par phase : ouverture, milieu, fin. */
  erreurs: [number, number, number];
}

/** Empreinte courte et stable d'un texte (FNV-1a 32 bits), pour reconnaître une partie déjà revue. */
export function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** Erreurs du joueur par phase, d'après les notes de la revue (`notes[k - 1]` : coup k). */
export function erreursParPhaseDe(notes: readonly ({ note: Note; couleur: Color; coup: number } | null)[], joueur: Color, total: number, taille: number): [number, number, number] {
  const e: [number, number, number] = [0, 0, 0];
  for (const n of notes) {
    if (!n || n.couleur !== joueur || !NOTES_ERREUR.has(n.note)) continue;
    e[PHASES.indexOf(phaseDuCoup(n.coup, total, taille))]++;
  }
  return e;
}

/** Une revue lue (stockage), ou `null` si elle est abîmée. */
export function lireRevue(x: unknown): RevueGardee | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.cle !== 'string' || typeof o.date !== 'string' || Number.isNaN(Date.parse(o.date))) return null;
  if (typeof o.taille !== 'number' || ![9, 13, 19].includes(o.taille)) return null;
  if (typeof o.precision !== 'number' || !(o.precision >= 0 && o.precision <= 100)) return null;
  const e = o.erreurs;
  if (!Array.isArray(e) || e.length !== 3 || !e.every(v => Number.isInteger(v) && v >= 0 && v < 1000)) return null;
  return { cle: o.cle, date: o.date, taille: o.taille, precision: o.precision, erreurs: [e[0], e[1], e[2]] };
}

export function lireRevues(brut: unknown): RevueGardee[] {
  return (Array.isArray(brut) ? brut : []).map(lireRevue).filter((x): x is RevueGardee => !!x).slice(0, MAX_REVUES);
}

/** Ajoute une revue en tête (remplace la revue de la même partie), garde les `max` plus récentes. */
export function ajouterRevue(liste: readonly RevueGardee[], r: RevueGardee, max = MAX_REVUES): RevueGardee[] {
  return [r, ...liste.filter(x => x.cle !== r.cle)].slice(0, max);
}

/** Précision moyenne des `n` revues les plus récentes, arrondie ; `null` sans revue. */
export function precisionMoyenne(liste: readonly RevueGardee[], n = REVUES_MOYENNE): { valeur: number; parties: number } | null {
  const r = liste.slice(0, n);
  if (!r.length) return null;
  return { valeur: Math.round(r.reduce((s, x) => s + x.precision, 0) / r.length), parties: r.length };
}

/** Erreurs moyennes par partie, par phase, sur les `n` revues les plus récentes ; `null` sans revue. */
export function erreursMoyennes(liste: readonly RevueGardee[], n = REVUES_MOYENNE): { ouverture: number; milieu: number; fin: number; parties: number } | null {
  const r = liste.slice(0, n);
  if (!r.length) return null;
  const moy = (i: number) => Math.round((10 * r.reduce((s, x) => s + x.erreurs[i], 0)) / r.length) / 10;
  return { ouverture: moy(0), milieu: moy(1), fin: moy(2), parties: r.length };
}

/** Phase où le joueur se trompe le plus (au moins 0,5 erreur par partie), pour la phrase de Mochi ; `null` sinon. */
export function phaseFaible(m: { ouverture: number; milieu: number; fin: number } | null): Phase | null {
  if (!m) return null;
  let best: Phase | null = null, max = 0.5 - 1e-9;
  for (const p of PHASES) if (m[p] > max) { max = m[p]; best = p; }
  return best;
}

// ---------- Bilan par taille et par mode ----------

export type ModeBilan = 'ordi' | 'guidee' | 'defi' | 'enLigne';
export const MODES_BILAN: readonly ModeBilan[] = ['ordi', 'guidee', 'defi', 'enLigne'];
export const TAILLES_BILAN = [9, 13, 19] as const;
export type TailleBilan = (typeof TAILLES_BILAN)[number];

export interface Score { v: number; d: number }
export interface Bilan { taille: Record<TailleBilan, Score>; mode: Record<ModeBilan, Score>; total: number }

/** Partie classée en ligne (#417), lue dans `rating_history` : taille connue ou non, gagnée si la cote a monté. */
export interface PartieClassee { taille: number | null; gagnee: boolean }

const vide = (): Score => ({ v: 0, d: 0 });

/**
 * Bilan : victoires et défaites par taille et par mode. Parties à deux et parties importées exclues (ce ne sont pas
 * tes parties ici) ; égalités et résultats inconnus non comptés. Les parties classées en ligne viennent à part
 * (elles ne sont pas dans l'historique de l'appareil).
 */
export function bilanDe(parties: readonly PartieHistorique[], classees: readonly PartieClassee[] = []): Bilan {
  const b: Bilan = { taille: { 9: vide(), 13: vide(), 19: vide() }, mode: { ordi: vide(), guidee: vide(), defi: vide(), enLigne: vide() }, total: 0 };
  const compter = (taille: number | null, mode: ModeBilan, gagne: boolean) => {
    const k = gagne ? 'v' : 'd';
    b.mode[mode][k]++;
    if (taille === 9 || taille === 13 || taille === 19) b.taille[taille][k]++;
    b.total++;
  };
  for (const p of parties) {
    if (p.mode !== 'ordi' && p.mode !== 'guidee' && p.mode !== 'defi') continue;
    const issue = issueDe(p);
    if (issue === 'victoire' || issue === 'defaite') compter(p.taille, p.mode, issue === 'victoire');
  }
  for (const c of classees) compter(c.taille, 'enLigne', c.gagnee);
  return b;
}

/** Part des victoires, en pour cent arrondi ; `null` sans partie. */
export const partGagnee = (s: Score): number | null => (s.v + s.d ? Math.round((100 * s.v) / (s.v + s.d)) : null);

// ---------- Courbe de la cote ----------

export interface PointCote { le: string; cote: number }

/** Bornes de la courbe : au moins un grade (100 points) de hauteur, pour qu'un petit écart ne paraisse pas énorme. */
export function bornesCourbe(valeurs: readonly number[]): { bas: number; haut: number } {
  const min = Math.min(...valeurs), max = Math.max(...valeurs), milieu = (min + max) / 2;
  return { bas: Math.min(min, milieu - 50), haut: Math.max(max, milieu + 50) };
}

/** Tracé SVG de la courbe (chemin `d`) dans un repère `l` × `h` avec une marge `m`. */
export function traceCourbe(valeurs: readonly number[], l: number, h: number, m: number): { d: string; x: (i: number) => number; y: (v: number) => number } {
  const { bas, haut } = bornesCourbe(valeurs.length ? valeurs : [0]);
  const x = (i: number) => m + (i * (l - 2 * m)) / Math.max(1, valeurs.length - 1);
  const y = (v: number) => h - m - ((v - bas) * (h - 2 * m)) / (haut - bas);
  const d = valeurs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return { d, x, y };
}

// ---------- Stockage (appareil) ----------

/**
 * Garde le résumé d'une revue avec KataGo (#368), appelée par la revue (src/app/Revue.tsx) une fois l'analyse finie.
 * Sans effet si le stockage est indisponible.
 */
export function garderRevue(r: RevueGardee): void {
  try {
    const avant = lireRevues(JSON.parse(localStorage.getItem(STATS_REVUES_KEY) ?? '[]'));
    localStorage.setItem(STATS_REVUES_KEY, JSON.stringify(ajouterRevue(avant, r)));
  } catch { /* stockage plein ou indisponible : la revue reste affichée, sans entrer dans les statistiques */ }
}

/** Revues gardées sur l'appareil. */
export function revuesAppareil(): RevueGardee[] {
  try { return lireRevues(JSON.parse(localStorage.getItem(STATS_REVUES_KEY) ?? '[]')); } catch { return []; }
}
