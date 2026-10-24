// Joueurs en ligne en ce moment (issue #695) : un seul nombre, lu par la fonction serveur `joueurs_en_ligne()`
// (supabase/migrations/20261024090000_joueurs_en_ligne.sql : file d'attente et parties classées en direct, présence
// récente, aucun identifiant). L'accueil s'en sert pour choisir son action principale (src/app/modes.ts, SEUIL_EN_LIGNE).
// Tout échec vaut « on ne sait pas » (null), que l'accueil compte comme moins que le seuil : hors ligne, pas de réponse
// dans le délai, erreur, fonction pas encore déployée ou réponse absurde ne changent jamais l'écran.
import type { Db } from './supabase';

/** Au-delà, pas de réponse : l'accueil ne doit pas attendre le réseau. */
export const DELAI_COMPTEUR_MS = 4000;
/** Une lecture est gardée ce temps-là : revenir à l'accueil n'appelle pas le serveur à chaque fois. */
export const FRAICHEUR_COMPTEUR_MS = 60_000;

/** Nombre entier positif ou nul ; tout le reste (null, texte, négatif, NaN) : inconnu. */
export function nombreDeJoueurs(brut: unknown): number | null {
  return typeof brut === 'number' && Number.isInteger(brut) && brut >= 0 ? brut : null;
}

/** Lit le compteur. Jamais d'exception, jamais plus de `delai` ms d'attente : null si on ne sait pas. */
export async function lireJoueursEnLigne(db: Db, delai = DELAI_COMPTEUR_MS): Promise<number | null> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const trop = new Promise<null>(r => { minuteur = setTimeout(() => r(null), delai); });
  try {
    const lecture = (async () => {
      const { data, error } = await db.rpc('joueurs_en_ligne');
      return error ? null : nombreDeJoueurs(data);
    })();
    return await Promise.race([lecture, trop]);
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Dernière lecture réussie de la session, gardée `FRAICHEUR_COMPTEUR_MS` : l'accueil de retour n'attend pas le réseau. */
let gardee: { n: number; le: number } | null = null;

/** Valeur gardée et encore fraîche, sinon null. */
export function compteurGarde(maintenant = Date.now()): number | null {
  return gardee && maintenant - gardee.le < FRAICHEUR_COMPTEUR_MS ? gardee.n : null;
}

/** Lecture partagée : réutilise la valeur fraîche, sinon lit le serveur (et la garde si elle est connue). */
export async function joueursEnLigne(db: Db, maintenant = Date.now()): Promise<number | null> {
  const fraiche = compteurGarde(maintenant);
  if (fraiche !== null) return fraiche;
  const n = await lireJoueursEnLigne(db);
  gardee = n === null ? null : { n, le: maintenant };
  return n;
}

/** Pour les tests. */
export function oublierCompteur(): void { gardee = null; }
