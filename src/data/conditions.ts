// Preuve d'acceptation des conditions (décision D2 de docs/juridique/compte-obligatoire.md, suite de #343).
// La case « J'ai 15 ans ou plus, ou un parent est d'accord. J'accepte les conditions et la politique » est cochée
// partout où un compte naît. Une fois la session d'un VRAI compte ouverte (code vérifié, retour de Google, e-mail
// relié à une ancienne session anonyme), l'écran appelle `accepterConditions` : le serveur garde la date et la
// version (fonction `accepter_conditions`, migration 20261002000100_preuve_conditions.sql). Le client ne peut pas
// écrire ces colonnes directement.
//
// Branchement attendu (front, pas fait ici) :
// - après `verifierCode` réussi (création de compte ou « J'ai déjà un compte »), et au retour de Google
//   (`go.retour-connexion.v1` dit que la case était cochée) : `await accepterConditions(db)` ;
// - au chargement du profil : si `conditionsAJour(profile)` est faux, redemander la case (conditions changées), puis
//   `accepterConditions(db)`. Une session anonyme n'a rien à accepter : le serveur refuse avec JGC01.
import type { Profile, Result } from './account';
import type { Db } from './supabase';
import { t } from '../content/i18n';

/**
 * Version des conditions en vigueur : date (AAAA-MM-JJ) de la dernière mise à jour de docs/juridique/cgu.md.
 * À changer à chaque nouvelle version des CGU ou de la politique : le serveur redemande alors l'accord.
 */
export const VERSION_CONDITIONS = '2026-09-30';

const FORMAT_VERSION = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai si la version a la forme attendue par le serveur (date AAAA-MM-JJ). */
export const versionValide = (version: string): boolean => FORMAT_VERSION.test(version);

/** Vrai si le profil a accepté la version en vigueur des conditions. */
export function conditionsAJour(profile: Pick<Profile, 'conditions_version'> | null | undefined, version = VERSION_CONDITIONS): boolean {
  return profile?.conditions_version === version;
}

/**
 * Enregistre sur le serveur que le joueur connecté a accepté les conditions (version en vigueur par défaut).
 * Renvoie la date gardée (la première, si cette version était déjà acceptée).
 */
export async function accepterConditions(db: Db, version = VERSION_CONDITIONS): Promise<Result<Date>> {
  if (!versionValide(version)) return { ok: false, error: t('erreur.serveur') };
  const { data, error } = await db.rpc('accepter_conditions', { p_version: version });
  if (error) return { ok: false, error: t('erreur.serveur') };
  const date = new Date(data);
  if (Number.isNaN(date.getTime())) return { ok: false, error: t('erreur.serveur') };
  return { ok: true, value: date };
}
