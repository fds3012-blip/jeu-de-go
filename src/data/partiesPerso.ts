// « Mes parties » synchronisées (issue #358, suite) : avec un compte, les parties de l'appareil (contre l'ordi,
// guidées, à deux, importées) sont aussi gardées sur le serveur, et un nouvel appareil les retrouve.
// Serveur : table `parties_perso` (lecture sous RLS : seulement les siennes) et fonction `enregistrer_parties_perso`
// (compte avec pseudo exigé, sans doublon, 500 parties au plus, SGF de 64 Kio au plus) :
// supabase/migrations/20261002140100_parties_perso.sql.
//
// Principe :
// - l'appareil reste la source de l'écran : hors ligne, tout marche comme avant ;
// - chaque partie a une clé stable calculée sur l'appareil, SHA-256 de « date ISO + saut de ligne + SGF » ; le serveur
//   ignore une clé déjà connue (`on conflict do nothing`) ;
// - les clés déjà envoyées sont notées sur l'appareil (SYNCHRO_KEY, par compte) : un envoi ne repart pas à chaque
//   ouverture ; un envoi raté (hors ligne, serveur indisponible) est simplement refait la fois suivante ;
// - à la lecture, les parties du serveur s'ajoutent à celles de l'appareil (historique.ts, `fusionner`).
// Module chargé à la demande (App.tsx, MesParties.tsx) : l'accueil ne l'embarque pas (#323).
import type { Result } from './account';
import type { Json } from './database.types';
import type { Db } from './supabase';
import { historiqueAppareil, lireEntree, type ModePartie, type PartieHistorique } from '../app/historique';
import { t } from '../content/i18n';

/** Clés déjà sur le serveur, pour le compte connecté sur cet appareil. */
export const SYNCHRO_KEY = 'go.historique.synchro.v1';
/** Taille maximale d'un SGF gardé sur le serveur (octets, UTF-8). */
export const MAX_SGF = 65_536;
/** Parties par envoi (le serveur en accepte 50 au plus). */
export const PAR_ENVOI = 50;
/** Parties gardées sur le serveur par joueur. */
export const MAX_SERVEUR = 500;
/** Parties lues sur le serveur pour l'affichage. */
export const LUES = 200;
/** Code d'erreur du serveur : 500 parties déjà gardées. */
export const CODE_PLEIN = 'JGL01';
/** Clés notées sur l'appareil : au-delà, les plus anciennes sont oubliées (elles seraient renvoyées sans effet). */
const MAX_NOTEES = 600;

const MODES_ENVOYES: readonly ModePartie[] = ['ordi', 'guidee', 'deux', 'import'];

/** Ligne envoyée au serveur (argument `p_parties` de `enregistrer_parties_perso`) et relue depuis `parties_perso`. */
export interface LignePerso {
  cle: string;
  joue_le: string;
  sgf: string;
  mode: string;
  taille: number;
  joueur: number | null;
  adversaire: string | null;
  resultat: string | null;
}

/** Date au format ISO de JavaScript (`…T10:00:00.000Z`), la même sur l'appareil et relue du serveur. */
export const dateCanonique = (d: string): string => new Date(d).toISOString();

const octets = (s: string) => new TextEncoder().encode(s).length;

/** Cette partie peut-elle aller sur le serveur ? (mêmes règles que la fonction serveur ; les défis y sont déjà) */
export function envoyable(p: PartieHistorique, maintenant = Date.now()): boolean {
  const d = Date.parse(p.date);
  return MODES_ENVOYES.includes(p.mode)
    && Number.isFinite(d) && d >= Date.UTC(2000, 0, 1) && d <= maintenant + 86_400_000
    && p.sgf.startsWith('(') && octets(p.sgf) <= MAX_SGF
    && p.taille >= 2 && p.taille <= 19
    && (p.adversaire === undefined || p.adversaire.length <= 40)
    && (p.resultat === undefined || p.resultat.length <= 20);
}

/** Clé stable d'une partie : SHA-256 (hexadécimal) de « date ISO + saut de ligne + SGF ». `null` sans WebCrypto. */
export async function cleDe(p: PartieHistorique): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const h = await subtle.digest('SHA-256', new TextEncoder().encode(`${dateCanonique(p.date)}\n${p.sgf}`));
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

export function versLigne(p: PartieHistorique, cle: string): LignePerso {
  return {
    cle, joue_le: dateCanonique(p.date), sgf: p.sgf, mode: p.mode, taille: p.taille, joueur: p.joueur,
    adversaire: p.adversaire ?? null, resultat: p.resultat ?? null,
  };
}

/** Ligne du serveur → entrée d'historique (identifiant : la date ISO, comme sur l'appareil). `null` si abîmée. */
export function depuisLigne(l: Partial<LignePerso> | null | undefined): PartieHistorique | null {
  if (!l || typeof l.joue_le !== 'string' || Number.isNaN(Date.parse(l.joue_le))) return null;
  const date = dateCanonique(l.joue_le);
  const p = lireEntree({ ...l, id: date, date, adversaire: l.adversaire ?? undefined, resultat: l.resultat ?? undefined });
  return p && p.mode !== 'defi' ? p : null;
}

// ---------- Clés déjà envoyées (appareil) ----------

interface Notees { compte: string; cles: string[] }

/** Clés notées pour ce compte ; vide pour un autre compte, ou si le stockage est abîmé ou indisponible. */
export function lireNotees(brut: unknown, compte: string): string[] {
  const o = brut as Partial<Notees> | null;
  if (!o || typeof o !== 'object' || o.compte !== compte || !Array.isArray(o.cles)) return [];
  return o.cles.filter((c): c is string => typeof c === 'string' && /^[0-9a-f]{64}$/.test(c));
}

/** Ajoute des clés (les plus récentes à la fin), sans doublon, et en garde MAX_NOTEES au plus. */
export function noter(notees: readonly string[], nouvelles: Iterable<string>): string[] {
  const s = new Set(notees);
  for (const c of nouvelles) { s.delete(c); s.add(c); }
  return [...s].slice(-MAX_NOTEES);
}

function lireStockage(compte: string): string[] {
  try { return lireNotees(JSON.parse(localStorage.getItem(SYNCHRO_KEY) ?? 'null'), compte); } catch { return []; }
}
function ecrireStockage(compte: string, cles: string[]): void {
  try { localStorage.setItem(SYNCHRO_KEY, JSON.stringify({ compte, cles } satisfies Notees)); } catch { /* stockage plein ou indisponible */ }
}

/** Parties de l'appareil à envoyer : envoyables, avec leur clé, sans celles déjà notées. La plus ancienne d'abord. */
export async function aEnvoyer(parties: readonly PartieHistorique[], notees: ReadonlySet<string>, maintenant = Date.now()): Promise<LignePerso[]> {
  const out: LignePerso[] = [];
  for (const p of parties) {
    if (!envoyable(p, maintenant)) continue;
    const cle = await cleDe(p);
    if (cle && !notees.has(cle)) out.push(versLigne(p, cle));
  }
  return out.sort((a, b) => Date.parse(a.joue_le) - Date.parse(b.joue_le));
}

/** Découpe en paquets de `n`. */
export function paquets<T>(liste: readonly T[], n = PAR_ENVOI): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < liste.length; i += n) out.push(liste.slice(i, i + n));
  return out;
}

// ---------- Serveur ----------

const echec = (message?: string | null): { ok: false; error: string } => ({ ok: false, error: message || t('erreur.serveur') });

/**
 * Parties gardées sur le serveur pour ce compte, la plus récente d'abord (RLS : seulement les siennes). Leurs clés
 * sont notées : un nouvel appareil ne les renverra pas.
 */
export async function lirePartiesPerso(db: Db, userId: string, n = LUES): Promise<Result<PartieHistorique[]>> {
  const r = await db.from('parties_perso').select('cle, joue_le, sgf, mode, taille, joueur, adversaire, resultat')
    .eq('user_id', userId).order('joue_le', { ascending: false }).limit(n);
  if (r.error) return echec(r.error.message);
  const lignes = r.data ?? [];
  const cles = lignes.map(l => l.cle).filter(c => typeof c === 'string');
  if (cles.length) ecrireStockage(userId, noter(lireStockage(userId), cles));
  return { ok: true, value: lignes.flatMap(l => { const p = depuisLigne(l); return p ? [p] : []; }) };
}

export type Bilan = { envoyees: number; plein: boolean } | { erreur: string };

let enCours: Promise<Bilan> | null = null;

/**
 * Envoie au serveur les parties de l'appareil qui n'y sont pas encore. Sans effet hors ligne (l'envoi échoue, rien
 * n'est noté, il sera refait). Un seul envoi à la fois : un second appel attend le premier, puis repart (une partie
 * peut s'être ajoutée entre-temps).
 */
export function synchroniser(db: Db, userId: string, parties: () => readonly PartieHistorique[] = historiqueAppareil): Promise<Bilan> {
  const suite = (enCours ?? Promise.resolve(null)).catch(() => null).then(() => envoyer(db, userId, parties()));
  enCours = suite;
  void suite.finally(() => { if (enCours === suite) enCours = null; });
  return suite;
}

async function envoyer(db: Db, userId: string, parties: readonly PartieHistorique[]): Promise<Bilan> {
  let notees = lireStockage(userId);
  const lignes = await aEnvoyer(parties, new Set(notees));
  let envoyees = 0;
  for (const paquet of paquets(lignes)) {
    const r = await db.rpc('enregistrer_parties_perso', { p_parties: paquet as unknown as Json });
    if (r.error) {
      if (r.error.code === CODE_PLEIN) return { envoyees, plein: true };
      return { erreur: r.error.message || t('erreur.serveur') };
    }
    const acceptees = (Array.isArray(r.data) ? r.data : []).filter((c): c is string => typeof c === 'string');
    notees = noter(notees, acceptees);
    ecrireStockage(userId, notees);
    envoyees += acceptees.length;
  }
  return { envoyees, plein: false };
}
