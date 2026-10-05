// Sécurité entre joueurs (#363, #373) : signalements, blocage, messages prédéfinis en partie.
// Toute la règle est côté serveur (supabase/migrations/20261005220100_securite_signalements.sql) : compte avec pseudo,
// 10 signalements par 24 heures, 10 messages par partie et par joueur, 3 s entre deux, jamais de texte libre en partie,
// le joueur bloqué n'est ni apparié, ni autorisé à défier ou à demander en ami. Le client ne fait que présenter.
// Les fonctions prennent et rendent des pseudos ou une partie : jamais d'identifiant d'un autre joueur.
import type { Result } from './account';
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';
import type { Db } from './supabase';
import { suivreLignes } from './tempsReel';
import { tsec } from '../content/i18n/securite';

export type TypeSignalement = 'joueur' | 'probleme' | 'bug' | 'idee' | 'autre';
export const MOTIFS_JOUEUR = ['triche', 'antijeu', 'abandon', 'pseudo', 'autre'] as const;
export const MOTIFS_PROBLEME = ['reponse_fausse', 'enonce', 'autre'] as const;
export type MotifJoueur = (typeof MOTIFS_JOUEUR)[number];
export type MotifProbleme = (typeof MOTIFS_PROBLEME)[number];
export const TEXTE_MAX = 500;

/** Messages prédéfinis (#373), dans l'ordre de la feuille ; puis les quatre émotes de Mochi. */
export const MESSAGES = ['bonne_partie', 'bien_joue', 'merci', 'joli_coup', 'oups', 'a_la_prochaine'] as const;
export const EMOTES = ['mochi_salut', 'mochi_content', 'mochi_fier', 'mochi_pensif'] as const;
export type CodeMessage = (typeof MESSAGES)[number] | (typeof EMOTES)[number];
export const MESSAGES_PAR_PARTIE = 10;
export const DELAI_MESSAGES_MS = 3000;
/** Durée d'une bulle à l'écran (#373 : 3 s). */
export const DUREE_BULLE_MS = 3000;

export function estCodeMessage(v: unknown): v is CodeMessage {
  return typeof v === 'string' && ((MESSAGES as readonly string[]).includes(v) || (EMOTES as readonly string[]).includes(v));
}
export const estEmote = (c: CodeMessage): c is (typeof EMOTES)[number] => (EMOTES as readonly string[]).includes(c);

/** Refus connus du serveur (codes SQLSTATE de la migration). */
export const CODES_SECURITE = {
  JGS01: 'limiteJour',
  JGS02: 'malForme',
  JGS03: 'toiMeme',
  JGB01: 'indisponible',
  JGB02: 'toiMeme',
  JGB03: 'tropDeBlocages',
  JGM01: 'limitePartie',
  JGM02: 'malForme',
  JGM03: 'tropVite',
  JGM04: 'partieFinie',
  JGA01: 'introuvable',
  P0002: 'introuvable',
  [CODE_COMPTE_REQUIS]: 'compte',
  [CODE_PSEUDO_REQUIS]: 'compte',
} as const;
export type RefusSecurite = (typeof CODES_SECURITE)[keyof typeof CODES_SECURITE];

export function refusSecurite(erreur: unknown): RefusSecurite | null {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code in CODES_SECURITE ? CODES_SECURITE[code as keyof typeof CODES_SECURITE] : null;
}

/** Message clair (FR/EN) d'une erreur : le refus connu, sinon un message générique (jamais le texte brut du serveur). */
export function messageSecurite(erreur: unknown): string {
  const refus = refusSecurite(erreur);
  return tsec(refus ? `erreur.${refus}` : 'erreur.serveur');
}

const echec = (erreur: unknown): { ok: false; error: string } => ({ ok: false, error: messageSecurite(erreur) });

/** Ce qu'on signale : un joueur (par sa partie ou son pseudo), un problème, ou un message à l'équipe. */
export type Demande =
  | { type: 'joueur'; motif: MotifJoueur; texte?: string; partie?: string; pseudo?: string }
  | { type: 'probleme'; motif: MotifProbleme; texte?: string; probleme: string }
  | { type: 'bug' | 'idee' | 'autre'; texte: string };

/** Contexte technique facultatif : jamais d'e-mail ni de pseudo, seulement de quoi reproduire un bug. */
export function contexteTechnique(ecran: string): Record<string, string | number | boolean> {
  const c: Record<string, string | number | boolean> = { ecran };
  if (typeof window !== 'undefined') {
    c.largeur = window.innerWidth;
    c.hauteur = window.innerHeight;
    c.installee = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  }
  if (typeof document !== 'undefined') c.langue = document.documentElement.lang || 'fr';
  if (typeof navigator !== 'undefined') c.navigateur = navigator.userAgent.slice(0, 160);
  return c;
}

/** Version de l'app au format accepté par le serveur, ou null. */
export function versionPourServeur(v: string | null | undefined): string | null {
  const s = (v ?? '').slice(0, 40);
  return /^[A-Za-z0-9._+-]{1,40}$/.test(s) ? s : null;
}

/** Texte nettoyé (espaces autour), coupé à 500 caractères ; null s'il est vide. */
export function texteNettoye(brut: string | undefined): string | null {
  const t = (brut ?? '').trim();
  return t ? t.slice(0, TEXTE_MAX) : null;
}

export async function signaler(db: Db, d: Demande, o: { version?: string | null; ecran: string }): Promise<Result<true>> {
  const joueur = d.type === 'joueur' ? d : null;
  try {
    // Objet écrit en entier : le contrat client ↔ serveur (contrat-serveur.test.ts) compare ces noms à la migration.
    const { error } = await db.rpc('signaler', {
      p_type: d.type, p_motif: d.type === 'joueur' || d.type === 'probleme' ? d.motif : undefined, p_texte: texteNettoye(d.texte) ?? undefined,
      p_pseudo: joueur?.pseudo, p_partie: joueur?.partie, p_probleme: d.type === 'probleme' ? d.probleme : undefined,
      p_version: versionPourServeur(o.version) ?? undefined, p_contexte: contexteTechnique(o.ecran),
    });
    return error ? echec(error) : { ok: true, value: true };
  } catch (e) { return echec(e); }
}

/** Bloque l'adversaire d'une partie, ou un joueur par son pseudo. */
export async function bloquer(db: Db, cible: { partie: string } | { pseudo: string }): Promise<Result<true>> {
  try {
    const { error } = await db.rpc('bloquer_joueur', { p_pseudo: 'pseudo' in cible ? cible.pseudo : undefined, p_partie: 'partie' in cible ? cible.partie : undefined });
    return error ? echec(error) : { ok: true, value: true };
  } catch (e) { return echec(e); }
}

export async function debloquer(db: Db, pseudo: string): Promise<Result<true>> {
  try {
    const { error } = await db.rpc('debloquer_joueur', { p_pseudo: pseudo });
    return error ? echec(error) : { ok: true, value: true };
  } catch (e) { return echec(e); }
}

export interface Blocage { pseudo: string; depuis: string }

export function lireBlocages(data: unknown): Blocage[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(l => {
    const r = l as Record<string, unknown> | null;
    return r && typeof r.pseudo === 'string' ? [{ pseudo: r.pseudo, depuis: typeof r.depuis === 'string' ? r.depuis : '' }] : [];
  });
}

export async function mesBlocages(db: Db): Promise<Result<Blocage[]>> {
  try {
    const { data, error } = await db.rpc('mes_blocages');
    return error ? echec(error) : { ok: true, value: lireBlocages(data) };
  } catch (e) { return echec(e); }
}

/** Envoie un message prédéfini ou une émote dans une partie (#373). */
export async function direEnPartie(db: Db, partie: string, code: CodeMessage): Promise<Result<true>> {
  try {
    const { error } = await db.rpc('dire_en_partie', { p_partie: partie, p_code: code });
    return error ? echec(error) : { ok: true, value: true };
  } catch (e) { return echec(e); }
}

export interface MessageRecu { id: number; auteur: string; code: CodeMessage }

/** Ligne `messages_partie` poussée par le temps réel, ou null si elle est mal formée. */
export function lireMessage(ligne: Record<string, unknown>): MessageRecu | null {
  const id = Number(ligne.id);
  if (!Number.isFinite(id) || typeof ligne.auteur_id !== 'string' || !estCodeMessage(ligne.code)) return null;
  return { id, auteur: ligne.auteur_id, code: ligne.code };
}

/**
 * Messages d'une partie, en temps réel (INSERT de `messages_partie`, RLS : les deux joueurs, sans les messages d'un
 * joueur bloqué). Pas de relecture : une bulle manquée pendant une coupure ne se rattrape pas, elle n'a de sens que
 * sur le moment. Renvoie la fonction qui arrête le suivi.
 */
export function abonnerMessages(db: Db, partie: string, surMessage: (m: MessageRecu) => void): () => void {
  return suivreLignes(db, `messages-${partie}`, [
    { table: 'messages_partie', filtre: `partie_id=eq.${partie}`, evenement: 'INSERT', surLigne: l => { const m = lireMessage(l); if (m) surMessage(m); } },
  ], { rattraper: () => undefined });
}

// --- Réglage « Messages de l'adversaire » (#373), gardé sur l'appareil. ---
export const ECHANGES_KEY = 'go.echanges.v1';
const abonnes = new Set<() => void>();
let memoire: boolean | null = null;

/** Vrai si le joueur a coupé les messages et émotes de ses adversaires. */
export function messagesCoupes(): boolean {
  try { return (JSON.parse(localStorage.getItem(ECHANGES_KEY) || '{}') as { coupes?: unknown }).coupes === true; } catch { return false; }
}
export function couperMessages(coupes: boolean): void {
  try { localStorage.setItem(ECHANGES_KEY, JSON.stringify({ coupes })); } catch { /* le choix reste pour la session */ }
  memoire = coupes;
  abonnes.forEach(f => f());
}
export const lireMessagesCoupes = (): boolean => memoire ?? messagesCoupes();
export const abonnerMessagesCoupes = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f); }; };
