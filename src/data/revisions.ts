// Révision espacée synchronisée entre les appareils d'un même compte (#469). Module chargé à la demande, avec un compte
// seulement (App.tsx) : l'accueil ne l'embarque pas. Sans compte, la file reste sur l'appareil.
// Serveur : table `revisions` (lisible par son seul propriétaire) et fonction `echanger_revisions` (le plus récent gagne,
// élément par élément) : supabase/migrations/20261007230100_revisions_espacees.sql. Logique : src/app/revisionsSynchro.ts.
//
// Principe, comme les réglages (#448) :
// - l'appareil reste la source de l'écran : hors ligne, la file locale reste valable ;
// - au démarrage connecté, l'appareil envoie sa file ; le serveur garde le plus récent et renvoie toute la file ;
//   l'appareil applique ce qui est plus récent que chez lui (un seul échange) ;
// - après chaque essai (événement `go:revisions`), un envoi part 2 secondes plus tard, sans bloquer l'écran ;
//   un envoi raté repart au changement suivant, au retour du réseau ou au retour sur l'app.
import type { Json } from './database.types';
import type { Db } from './supabase';
import { ERREURS_KEY } from '../app/erreurs';
import { writeLocal } from '../app/hooks';
import { EVENEMENT_REVISIONS } from '../app/revisionEspacee';
import { ecrireEtatAppareil, lireErreursAppareil, lireEtatAppareil, prevenir } from '../app/revisionsAppareil';
import { appliquerLignes, ligneValide, lignesLocales, type Ligne } from '../app/revisionsSynchro';

export const DELAI_ENVOI_MS = 2000;
const RELIRE_APRES_MS = 60_000;

/** Envoie la file de l'appareil et reçoit celle du serveur, ou null (hors ligne, erreur). */
export async function echanger(db: Db, lignes: Ligne[]): Promise<Ligne[] | null> {
  try {
    const { data, error } = await db.rpc('echanger_revisions', { p_elements: lignes as unknown as Json });
    if (error || !Array.isArray(data)) return null;
    return (data as unknown[]).map(ligneValide).filter((l): l is Ligne => l !== null);
  } catch { return null; }
}

/** Applique la file reçue sur l'appareil. Vrai si quelque chose a changé. */
export function appliquerServeur(lignes: Ligne[]): boolean {
  const r = appliquerLignes(lireErreursAppareil(), lireEtatAppareil(), lignes);
  if (!r.change) return false;
  writeLocal(ERREURS_KEY, r.erreurs);
  ecrireEtatAppareil(r.etat);
  return true;
}

/**
 * Démarre la synchronisation pour le compte connecté : un échange tout de suite, puis après chaque essai (groupé),
 * au retour du réseau et au retour sur l'app. Renvoie de quoi l'arrêter (déconnexion, autre compte).
 */
export function demarrerSynchroRevisions(db: Db): () => void {
  let actif = true;
  let file: Promise<void> = Promise.resolve();
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  let dernier = 0;
  // Nos propres écritures (réponse du serveur appliquée) ne relancent pas d'envoi.
  let applique = false;

  const synchroniser = () => {
    file = file.then(async () => {
      if (!actif) return;
      const serveur = await echanger(db, lignesLocales(lireErreursAppareil(), lireEtatAppareil()));
      if (!serveur || !actif) return;
      dernier = Date.now();
      // Relu après l'échange : un essai fait pendant l'envoi garde sa place (sa date est plus récente).
      if (appliquerServeur(serveur)) { applique = true; prevenir(); applique = false; }
    });
    return file;
  };
  const plusTard = () => {
    if (applique) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { void synchroniser(); }, DELAI_ENVOI_MS);
  };
  const auRetour = () => { if (document.visibilityState === 'visible' && Date.now() - dernier > RELIRE_APRES_MS) void synchroniser(); };
  const enLigne = () => { void synchroniser(); };

  window.addEventListener(EVENEMENT_REVISIONS, plusTard);
  window.addEventListener('online', enLigne);
  document.addEventListener('visibilitychange', auRetour);
  void synchroniser();
  return () => {
    actif = false;
    clearTimeout(minuterie);
    window.removeEventListener(EVENEMENT_REVISIONS, plusTard);
    window.removeEventListener('online', enLigne);
    document.removeEventListener('visibilitychange', auRetour);
  };
}
