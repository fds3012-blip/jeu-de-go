// Défis où c'est ton tour (#338, #367) : logique pure, à part de l'écran des défis (src/app/Defis.tsx).
// Chargée à la demande avec le reste d'« À faire » (src/app/aFaireCharge.ts, crochet src/app/useAFaire.ts).
import type { EtatDefi } from '../data/defi';
import { resumeDefi, vueDefi } from './defiAmi';
import type { DefiEnAttente } from './aFaire';

/** Défis où c'est au joueur d'agir (jouer, ou répondre au comptage), avec l'id de l'adversaire. */
export function defisEnAttente(etats: readonly EtatDefi[], userId: string, maintenant = Date.now()): (DefiEnAttente & { adversaireId: string | null })[] {
  return etats.flatMap(d => {
    const v = vueDefi(d.partie, d.defi, userId, maintenant, d.resultat);
    if (!resumeDefi(v).aMoi) return [];
    const adversaireId = (v.couleur === 1 ? d.partie.white_id : d.partie.black_id) ?? null;
    return [{ partieId: d.partie.id, adversaire: null, adversaireId, restant: v.restant, comptage: v.phase === 'comptage' }];
  });
}
