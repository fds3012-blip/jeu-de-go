// Historique de mes parties (issue #358) : logique pure, testée dans historique.test.ts.
// Jusqu'ici, une seule partie était gardée (`go.revue.v1`, la dernière jouée ou importée) : la suivante l'effaçait.
// Chaque partie terminée (contre l'ordi, guidée, à deux, importée) est maintenant gardée sur l'appareil, les 50 plus
// récentes, sous HISTORIQUE_KEY. Les défis par lien terminés viennent de Supabase (table `games`, lue sous RLS) et
// s'ajoutent à la liste à l'affichage ; ils ne sont pas recopiés sur l'appareil. Écran : src/app/MesParties.tsx.
// Avec un compte, les parties de l'appareil sont aussi gardées sur le serveur (table `parties_perso`,
// src/data/partiesPerso.ts) : elles s'ajoutent de même à l'affichage sur un autre appareil.
import { readSgf, writeSgf } from '../go/sgf';
import { recordFromOnlineGame } from '../go/server';
import type { Color } from '../go/rules';
import { NOMS, type PortraitId } from '../ui/Portrait';
import { langue, nombre, t } from '../content/i18n';
import { REVUE_KEY, type PartieGardee } from './revue';

/** Parties gardées sur l'appareil (liste JSON, la plus récente d'abord). */
export const HISTORIQUE_KEY = 'go.historique.v1';
/** Nombre de parties gardées sur l'appareil. */
export const MAX_PARTIES = 50;

export type ModePartie = 'ordi' | 'guidee' | 'deux' | 'import' | 'defi';
const MODES: readonly ModePartie[] = ['ordi', 'guidee', 'deux', 'import', 'defi'];

export interface PartieHistorique {
  /** Identifiant stable : la date de fin pour une partie de l'appareil, `defi:<id>` pour un défi. */
  id: string;
  /** Fin de la partie (ISO). */
  date: string;
  sgf: string;
  mode: ModePartie;
  taille: number;
  /** Camp du joueur ; `null` pour une partie à deux sur le même appareil. */
  joueur: Color | null;
  /** Contre l'ordi : identifiant de l'adversaire (`pomme`…). Partie importée ou défi : nom affiché. */
  adversaire?: string;
  /** Résultat au format SGF (`B+6.5`, `W+R`, `B+T`, `0`), s'il est connu. */
  resultat?: string;
}

const estCouleur = (c: unknown): c is Color => c === 1 || c === 2;

/** Une entrée lue (appareil ou serveur), ou `null` si elle est abîmée (stockage modifié à la main, ancienne version). */
export function lireEntree(x: unknown): PartieHistorique | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.sgf !== 'string' || !o.sgf.startsWith('(')) return null;
  if (typeof o.date !== 'string' || Number.isNaN(Date.parse(o.date))) return null;
  if (!MODES.includes(o.mode as ModePartie)) return null;
  if (typeof o.taille !== 'number' || o.taille < 2 || o.taille > 19) return null;
  const joueur = estCouleur(o.joueur) ? o.joueur : null;
  return {
    id: o.id, date: o.date, sgf: o.sgf, mode: o.mode as ModePartie, taille: o.taille, joueur,
    ...(typeof o.adversaire === 'string' && o.adversaire ? { adversaire: o.adversaire.slice(0, 40) } : {}),
    ...(typeof o.resultat === 'string' && o.resultat ? { resultat: o.resultat } : {}),
  };
}

/** Tri : la plus récente d'abord ; à date égale, l'ordre d'arrivée est gardé. */
export function trier(liste: readonly PartieHistorique[]): PartieHistorique[] {
  return liste.map((p, i) => ({ p, i, d: Date.parse(p.date) }))
    .sort((a, b) => b.d - a.d || a.i - b.i).map(x => x.p);
}

/**
 * Ajoute une partie : une partie de même identifiant ou de même SGF est remplacée (une partie importée deux fois
 * n'apparaît qu'une fois), puis la liste est triée et coupée aux `max` plus récentes.
 */
export function ajouterPartie(liste: readonly PartieHistorique[], p: PartieHistorique, max = MAX_PARTIES): PartieHistorique[] {
  return trier([p, ...liste.filter(x => x.id !== p.id && x.sgf !== p.sgf)]).slice(0, max);
}

/**
 * Entrée d'historique tirée de la partie gardée pour la revue (`go.revue.v1`). `mode` : connu de l'écran qui a lancé
 * la partie ; sinon on le déduit (importée, contre l'ordi si un adversaire est nommé, à deux sinon).
 */
export function depuisRevue(g: PartieGardee | null | undefined, mode?: ModePartie): PartieHistorique | null {
  if (!g || typeof g.sgf !== 'string' || typeof g.date !== 'string' || Number.isNaN(Date.parse(g.date))) return null;
  let rec;
  try { rec = readSgf(g.sgf); } catch { return null; }
  const m: ModePartie = mode ?? (g.importee ? 'import' : g.adversaire ? 'ordi' : 'deux');
  const joueur: Color | null = m === 'import' ? (estCouleur(g.joueur) ? g.joueur : 1) : m === 'deux' ? null : 1;
  return lireEntree({
    id: g.date, date: g.date, sgf: g.sgf, mode: m, taille: rec.size, joueur,
    adversaire: m === 'guidee' || m === 'deux' ? undefined : g.adversaire, resultat: rec.result,
  });
}

/** Liste lue sur l'appareil ; la partie de la revue (`go.revue.v1`) s'y ajoute si elle n'y est pas encore. */
export function lireHistorique(brut: unknown, revue?: PartieGardee | null): PartieHistorique[] {
  const liste = trier((Array.isArray(brut) ? brut : []).map(lireEntree).filter((x): x is PartieHistorique => !!x)).slice(0, MAX_PARTIES);
  const r = depuisRevue(revue);
  return r && !liste.some(p => p.id === r.id || p.sgf === r.sgf) ? ajouterPartie(liste, r) : liste;
}

/** Lit une clé JSON de l'appareil ; `null` si absente, illisible ou si le stockage est indisponible. */
function lireCle(cle: string): unknown {
  try { return JSON.parse(localStorage.getItem(cle) ?? 'null'); } catch { return null; }
}

/** Parties gardées sur l'appareil, la dernière partie de la revue comprise. */
export function historiqueAppareil(): PartieHistorique[] {
  return lireHistorique(lireCle(HISTORIQUE_KEY), lireCle(REVUE_KEY) as PartieGardee | null);
}

/**
 * Garde dans l'historique la partie que l'écran de partie ou d'import vient d'écrire pour la revue (`go.revue.v1`).
 * Appelée à la fin de chaque partie (App.tsx, `onResult`) et à chaque import (ImportSgf.tsx). Sans effet si rien n'est lisible.
 */
export function garderDerniere(mode?: ModePartie): void {
  const p = depuisRevue(lireCle(REVUE_KEY) as PartieGardee | null, mode);
  if (!p) return;
  try { localStorage.setItem(HISTORIQUE_KEY, JSON.stringify(ajouterPartie(lireHistorique(lireCle(HISTORIQUE_KEY)), p))); } catch { /* stockage plein ou indisponible */ }
}

/** Ligne de `games` nécessaire pour un défi terminé (voir src/data/database.types.ts). */
export interface LigneDefi {
  id: string; size: number; komi: number | string; rules: string; handicap: number; moves: string;
  black_id: string | null; white_id: string | null; status: string; result: string | null; updated_at: string;
}

/**
 * Défi par lien terminé → entrée d'historique, du point de vue de `userId`. `null` si la partie n'est pas lisible.
 * `adversaire` : pseudo de l'ami (#400), lu à part ; sans pseudo, la liste dit « Ton ami ».
 */
export function depuisDefi(g: LigneDefi, userId: string, resultat: string | null = g.result, adversaire?: string | null): PartieHistorique | null {
  const joueur: Color | null = g.black_id === userId ? 1 : g.white_id === userId ? 2 : null;
  if (!joueur || !(g.status === 'finished' || resultat)) return null;
  const rec = recordFromOnlineGame({ size: g.size, komi: Number(g.komi), rules: g.rules === 'chinese' ? 'chinese' : 'japanese', handicap: g.handicap, moves: g.moves });
  if (!rec) return null;
  const sgf = writeSgf({ ...rec, handicap: g.handicap || undefined, result: resultat ?? undefined });
  return lireEntree({ id: `defi:${g.id}`, date: g.updated_at, sgf, mode: 'defi', taille: g.size, joueur, resultat: resultat ?? undefined, adversaire: adversaire ?? undefined });
}

/** Nombre de parties affichées dans « Mes parties » quand le serveur en ajoute (le serveur en garde 500 au plus). */
export const MAX_AFFICHEES = 200;

/**
 * Fusionne l'appareil et le serveur (défis, parties gardées sur le compte) : l'appareil d'abord, puis un seul tri, et
 * toujours au plus `max` parties. Une même partie (même identifiant, ou même instant de fin et même SGF) n'apparaît
 * qu'une fois : celle de l'appareil est gardée.
 */
export function fusionner(appareil: readonly PartieHistorique[], serveur: readonly PartieHistorique[], max = MAX_PARTIES): PartieHistorique[] {
  const vus = new Set<string>();
  const uniques = [...appareil, ...serveur].filter(p => {
    const signature = `${Date.parse(p.date)}|${p.sgf}`;
    if (vus.has(p.id) || vus.has(signature)) return false;
    vus.add(p.id); vus.add(signature);
    return true;
  });
  return trier(uniques).slice(0, max);
}

// ---------- Affichage ----------

export type Issue = 'victoire' | 'defaite' | 'egalite';

interface Lu { vainqueur: Color | 0; raison: 'points' | 'abandon' | 'temps' | 'egalite'; marge?: number }

/** Résultat SGF lu : vainqueur (0 : égalité), raison et écart. `null` si le résultat est absent ou illisible. */
export function lireResultat(re: string | undefined): Lu | null {
  const r = (re ?? '').trim().toUpperCase();
  if (r === '0' || r === 'DRAW' || r === 'JIGO') return { vainqueur: 0, raison: 'egalite' };
  const m = /^([BW])\+(R|RESIGN|T|TIME|F|[0-9]+(?:[.,][0-9]+)?)?$/.exec(r);
  if (!m) return null;
  const vainqueur: Color = m[1] === 'B' ? 1 : 2;
  const suite = m[2] ?? '';
  if (suite.startsWith('R') || suite === 'F') return { vainqueur, raison: 'abandon' };
  if (suite.startsWith('T')) return { vainqueur, raison: 'temps' };
  const marge = Number(suite.replace(',', '.'));
  return suite && Number.isFinite(marge) ? { vainqueur, raison: 'points', marge } : { vainqueur, raison: 'abandon' };
}

/** Issue pour le joueur (sceau Victoire / Défaite) ; `null` pour une partie à deux ou un résultat inconnu. */
export function issueDe(p: PartieHistorique): Issue | null {
  const r = lireResultat(p.resultat);
  if (!r) return null;
  if (r.vainqueur === 0) return 'egalite';
  return p.joueur ? (r.vainqueur === p.joueur ? 'victoire' : 'defaite') : null;
}

/** Résultat en mots, au tutoiement : « Tu as gagné de 6,5 points », « Tu as abandonné », « Noir gagne de 3 points ». */
export function phraseResultat(p: PartieHistorique): string {
  const r = lireResultat(p.resultat);
  if (!r) return t('historique.resultat.inconnu');
  if (r.vainqueur === 0) return t('historique.resultat.egalite');
  const v = nombre(r.marge ?? 0);
  if (!p.joueur) {
    const camp = t(r.vainqueur === 1 ? 'camp.noir' : 'camp.blanc');
    if (r.raison === 'points') return t('historique.resultat.campPoints', { camp, v, n: r.marge ?? 0 });
    return t(r.raison === 'temps' ? 'historique.resultat.campTemps' : 'historique.resultat.campAbandon', { camp });
  }
  const gagne = r.vainqueur === p.joueur;
  if (r.raison === 'points') return t(gagne ? 'historique.resultat.gagnePoints' : 'historique.resultat.perduPoints', { v, n: r.marge ?? 0 });
  if (r.raison === 'temps') return t(gagne ? 'historique.resultat.gagneTemps' : 'historique.resultat.perduTemps');
  return t(gagne ? 'historique.resultat.gagneAbandon' : 'historique.resultat.perduAbandon');
}

/** Nom de l'adversaire affiché : portrait de l'échelle, Mochi, « Partie à deux », nom du fichier ou de l'ami. */
export function nomAdversaire(p: PartieHistorique): string {
  if (p.mode === 'guidee') return 'Mochi';
  if (p.mode === 'deux') return t('historique.aDeux');
  if (p.mode === 'ordi') return (p.adversaire && NOMS[p.adversaire as PortraitId]) || t('historique.ordi');
  if (p.mode === 'defi') return p.adversaire ?? t('defi.adversaire');
  return p.adversaire ?? t('historique.importee');
}

/** Identifiant de portrait (adversaire de l'échelle), si la partie en a un. */
export function portraitDe(p: PartieHistorique): PortraitId | null {
  return p.mode === 'ordi' && p.adversaire && p.adversaire in NOMS ? p.adversaire as PortraitId : null;
}

/** Numéro de jour local (minuit à minuit), pour compter les jours écoulés sans se tromper aux changements d'heure. */
const jourLocal = (d: Date) => Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);

/** Date relative : « Aujourd'hui », « Hier », « Il y a 3 jours », puis « 12 sept. » (l'année si elle diffère). */
export function dateRelative(iso: string, maintenant: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ecart = jourLocal(maintenant) - jourLocal(d);
  if (ecart <= 0) return t('historique.date.aujourdhui');
  if (ecart === 1) return t('historique.date.hier');
  if (ecart < 7) return t('historique.date.jours', { n: ecart });
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', ...(d.getFullYear() !== maintenant.getFullYear() ? { year: 'numeric' } : {}) };
  return d.toLocaleDateString(langue() === 'en' ? 'en-GB' : 'fr-FR', opts);
}

/** Étiquette accessible d'une ligne : adversaire, résultat, date, plateau. */
export function etiquette(p: PartieHistorique, maintenant: Date = new Date()): string {
  return t('historique.ligneAria', { nom: nomAdversaire(p), resultat: phraseResultat(p), date: dateRelative(p.date, maintenant), taille: p.taille });
}
