// Entonnoir essai → compte (#343) : `essai_limite_atteinte` → `lien_connexion_envoye` → `compte_cree` → `pseudo_choisi`.
// Rien n'est écrit sur l'appareil : le moyen de connexion n'est gardé que pour la page ouverte (pour Google, la note
// d'aller-retour de src/app/connexionGoogle.ts le rapporte au retour).
import type { EtatCompte } from './essai';

export type Moyen = 'code' | 'lien' | 'google';
let moyen: Moyen | null = null;

/** Le code à 6 chiffres vient d'être accepté dans cette page. */
export function noterConnexionParCode(): void { moyen = 'code'; }
/** La page revient de Google (#354). */
export function noterConnexionParGoogle(): void { moyen = 'google'; }

/** Moyen de la connexion en cours : le code tapé dans l'app, Google, sinon le lien de l'e-mail. */
export const moyenConnexion = (): Moyen => moyen ?? 'lien';

/**
 * Vrai quand un compte vient d'être créé : la session passe à « connecté sans pseudo » (un compte existant a déjà
 * son pseudo). Un joueur qui ferme l'app avant de choisir son pseudo repasse par là à son retour : l'événement
 * repart, ce qui est voulu (il n'a toujours pas de pseudo).
 */
export function compteVientDEtreCree(avant: EtatCompte | null, apres: EtatCompte): boolean {
  return apres === 'sans_pseudo' && avant !== 'sans_pseudo';
}
