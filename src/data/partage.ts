// Parties partagées (#364) : le lien vers la revue en lecture seule. Toute la sécurité est côté serveur
// (supabase/migrations/20261005213100_parties_partagees.sql) :
// - `partager_partie` : compte avec pseudo exigé (#343), SGF minimal vérifié, même partie = même lien, plafonds ;
// - `lire_partie_partagee` : lecture sans compte, par le seul jeton ;
// - `retirer_partie_partagee` : le joueur rend la partie privée.
// Module chargé à la demande (feuille de partage, écran de la partie partagée) : pas dans le JS initial.
import type { Result } from './account';
import type { Db } from './supabase';
import { FORMAT_JETON_PARTIE } from '../app/adressePartie';

export interface PartiePartagee {
  sgf: string;
  taille: number;
  /** Camp du joueur qui a partagé (1 Noir, 2 Blanc) ; null : partie à deux. */
  joueur: 1 | 2 | null;
  adversaire: string | null;
  /** Coup du moment clé, montré d'abord. */
  coup: number;
  /** Pseudo de qui a partagé (null : compte supprimé entre-temps, ou pseudo retiré). */
  pseudo: string | null;
}

/** Ce que l'écran affiche d'un refus : code du serveur connu, sinon générique. */
export type RefusPartage = 'compte' | 'pseudo' | 'jour' | 'plein' | 'illisible' | 'reseau';

function refus(code: string | undefined): RefusPartage {
  switch (code) {
    case 'JGC01': return 'compte';
    case 'JGP01': return 'pseudo';
    case 'JGS01': return 'jour';
    case 'JGS02': return 'plein';
    case '22023': return 'illisible';
    default: return 'reseau';
  }
}

export interface Publication { sgf: string; taille: number; joueur: 1 | 2 | null; adversaire: string | null; coup: number }

/** Rend publique la partie : renvoie le jeton du lien (le même si elle l'était déjà). */
export async function publierPartie(db: Db, p: Publication): Promise<Result<string> & { raison?: RefusPartage }> {
  const coup = Math.max(0, Math.min(1000, Math.round(p.coup)));
  const { data, error } = await db.rpc('partager_partie', { p_sgf: p.sgf, p_taille: p.taille, p_joueur: p.joueur, p_adversaire: p.adversaire, p_coup: coup });
  if (error || typeof data !== 'string' || !FORMAT_JETON_PARTIE.test(data)) {
    return { ok: false, error: error?.message ?? '', raison: refus(error?.code) };
  }
  return { ok: true, value: data };
}

/** Lit une partie partagée par son jeton, sans compte. `null` : lien inconnu ou retiré. */
export async function lirePartiePartagee(db: Db, jeton: string): Promise<Result<PartiePartagee | null>> {
  if (!FORMAT_JETON_PARTIE.test(jeton)) return { ok: true, value: null };
  const { data, error } = await db.rpc('lire_partie_partagee', { p_jeton: jeton });
  if (error) return { ok: false, error: error.message };
  const l = Array.isArray(data) ? data[0] : null;
  if (!l) return { ok: true, value: null };
  return {
    ok: true,
    value: {
      sgf: l.sgf, taille: l.taille, joueur: l.joueur === 1 || l.joueur === 2 ? l.joueur : null,
      adversaire: l.adversaire ?? null, coup: Number(l.coup) || 0, pseudo: l.pseudo ?? null,
    },
  };
}

/** Rend la partie privée : le lien ne montre plus rien. */
export async function retirerPartie(db: Db, jeton: string): Promise<Result<boolean>> {
  const { data, error } = await db.rpc('retirer_partie_partagee', { p_jeton: jeton });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: data === true };
}
