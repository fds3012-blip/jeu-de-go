// Inviter un ami (#729, docs/produit/invitation-2026-10.md) : le lien personnel, le code gardé par l'ami arrivé, et les
// deux fonctions du serveur (supabase/migrations/20261026090000_invitations.sql). Toutes les règles sont côté serveur :
// ce module ne décide de rien, il demande et note. Module chargé à la demande (écran « Inviter un ami » et fin de la
// synchronisation des parties) : le JS initial ne l'embarque pas.
// Ce que garde l'appareil : `go.invitation.v1` (le code reçu et sa date, posé par le script en tête d'index.html),
// `go.cadeaux.v1` (les cadeaux reçus, lus par xp.ts pour ouvrir le goban Cerisier et les pierres Jade).
import type { Result } from './account';
import type { Db } from './supabase';
import { EVENTS, track } from './analytics';
import { noterBadges } from '../app/badgesGagnes';
import { SITE_APP } from '../app/partageApp';
import { readLocal, writeLocal } from '../app/hooks';
import { t } from '../content/i18n';

export const INVITATION_KEY = 'go.invitation.v1';
export const CADEAUX_KEY = 'go.cadeaux.v1';
/** Un code reçu se garde 30 jours (le serveur refuse de toute façon un compte de plus de 30 jours). */
export const DUREE_CODE_MS = 30 * 24 * 60 * 60 * 1000;
const FORMAT_CODE = /^[A-Za-z0-9_-]{32}$/;

/** Les deux cadeaux : des décors qui existent déjà (xp.ts) et ne s'achètent pas. */
export const CADEAUX = ['cerisier', 'jade'] as const;
export type Cadeau = (typeof CADEAUX)[number];
export type StatutInvitation = 'validee' | 'deja' | 'attente' | 'complet' | 'invalide';
const STATUTS: readonly string[] = ['validee', 'deja', 'attente', 'complet', 'invalide'];

export interface EtatInvitation { code: string; amis: number; plafond: number; cadeaux: Cadeau[] }

/** Lien à partager : `https://mochi-go.app/i#CODE` (`/en/i#CODE`). Le code reste dans le fragment : jamais envoyé au serveur web. */
export const lienInvitation = (code: string, langue: 'fr' | 'en', origine = SITE_APP): string => `${origine}${langue === 'en' ? '/en' : ''}/i#${code}`;

/** Cadeaux lus dans une réponse du serveur, en ignorant ce qui est inconnu ou mal formé. */
export const lireCadeaux = (v: unknown): Cadeau[] => (Array.isArray(v) ? CADEAUX.filter(c => v.includes(c)) : []);

/** Le code gardé sur l'appareil s'il est bien formé et récent, sinon null. */
export function codeGarde(maintenant = Date.now()): { code: string; depuis: number } | null {
  const v = readLocal<{ c?: unknown; t?: unknown } | null>(INVITATION_KEY, null);
  return v && typeof v.c === 'string' && FORMAT_CODE.test(v.c) && typeof v.t === 'number' && v.t > maintenant - DUREE_CODE_MS
    ? { code: v.c, depuis: v.t } : null;
}

export function oublierCode(): void {
  try { localStorage.removeItem(INVITATION_KEY); } catch { /* stockage indisponible */ }
}

/** Cadeaux reçus sur cet appareil. */
export const cadeauxAppareil = (): Cadeau[] => lireCadeaux(readLocal<unknown>(CADEAUX_KEY, []));

/** Note les cadeaux (jamais retirés) et les badges qui vont avec : « parrain » dès un ami arrivé, « invité » pour l'ami. */
export function noterCadeaux(cadeaux: readonly Cadeau[], badges: readonly string[] = []): void {
  const tous = lireCadeaux([...cadeauxAppareil(), ...cadeaux]);
  if (tous.join() !== cadeauxAppareil().join()) writeLocal(CADEAUX_KEY, tous);
  if (badges.length) noterBadges(badges);
}

const echec = (): { ok: false; error: string } => ({ ok: false, error: t('erreur.serveur') });

/** L'écran « Inviter un ami » : mon code, mes amis arrivés, le plafond, mes cadeaux (compte avec pseudo exigé par le serveur). */
export async function monInvitation(db: Db): Promise<Result<EtatInvitation>> {
  const { data, error } = await db.rpc('mon_invitation');
  const l = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (error || !l || typeof l.code !== 'string' || !FORMAT_CODE.test(l.code)) return echec();
  const amis = typeof l.amis === 'number' ? l.amis : 0;
  const cadeaux = lireCadeaux(l.cadeaux);
  noterCadeaux(cadeaux, amis > 0 ? ['parrain'] : []);
  return { ok: true, value: { code: l.code, amis, plafond: typeof l.plafond === 'number' ? l.plafond : 5, cadeaux } };
}

/**
 * Demande au serveur de valider l'invitation gardée sur l'appareil. Le serveur répond `attente` tant que l'ami n'a pas
 * joué sa première vraie partie : le code est alors gardé et on redemandera à la prochaine synchronisation. Toute autre
 * réponse définitive (validée, déjà validée, complet, invalide) efface le code. Erreur (hors ligne, compte sans pseudo) :
 * le code reste. Rend le statut, ou null sans code ou sur erreur.
 */
export async function validerInvitationGardee(db: Db): Promise<StatutInvitation | null> {
  const garde = codeGarde();
  if (!garde) { oublierCode(); return null; }
  const { data, error } = await db.rpc('valider_invitation', { p_code: garde.code });
  const l = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (error || !l || typeof l.statut !== 'string' || !STATUTS.includes(l.statut)) return null;
  const statut = l.statut as StatutInvitation;
  if (statut === 'attente') return statut;
  if (statut === 'validee' || statut === 'deja') noterCadeaux(lireCadeaux(l.cadeaux), ['invite']);
  if (statut === 'validee') track(EVENTS.invitationValidee, { jours: Math.max(0, Math.floor((Date.now() - garde.depuis) / 86_400_000)) });
  oublierCode();
  return statut;
}
